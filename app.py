from flask import Flask, render_template, jsonify, request, redirect, url_for, session
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, timedelta
from connector import GmailConnector
from datetime import date

app = Flask(__name__)
app.secret_key = 'your-secret-key-here'  # Change this in production
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///budget.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

# Database Models
class Purchase(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    date = db.Column(db.DateTime, nullable=False)
    merchant = db.Column(db.String(200), nullable=False)
    amount = db.Column(db.Float, nullable=False)
    category = db.Column(db.String(100), default='Uncategorized')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Add a unique constraint to prevent duplicates
    __table_args__ = (
        db.Index('idx_unique_purchase', 'date', 'merchant', 'amount'),
    )

class CategoryRule(db.Model):
    """Rules for auto-categorizing purchases"""
    id = db.Column(db.Integer, primary_key=True)
    merchant_pattern = db.Column(db.String(200), nullable=False)  # Merchant name pattern
    category = db.Column(db.String(100), nullable=False)
    priority = db.Column(db.Integer, default=1)  # Higher priority rules are applied first
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    __table_args__ = (
        db.Index('idx_merchant_pattern', 'merchant_pattern'),
        db.Index('idx_category_rules', 'merchant_pattern'),
    )

class Budget(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    category = db.Column(db.String(100), unique=True, nullable=False)
    monthly_limit = db.Column(db.Float, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

# Initialize Gmail connector
gmail_connector = GmailConnector()

def auto_categorize_purchase(merchant):
    """Automatically categorize a purchase based on rules and patterns"""
    if not merchant:
        return 'Uncategorized'
    
    # Get all category rules ordered by priority
    rules = CategoryRule.query.order_by(CategoryRule.priority.desc()).all()
    
    for rule in rules:
        # Check if merchant matches the pattern
        if rule.merchant_pattern.lower() in merchant.lower():
            # If description pattern is specified, check that too
            return rule.category
    
    # If no rules match, try to infer from common patterns
    merchant_lower = merchant.lower()
    
    # Food & Dining
    food_keywords = ['restaurant', 'cafe', 'coffee', 'pizza', 'burger', 'subway', 'mcdonalds', 'tim hortons', 'starbucks']
    if any(keyword in merchant_lower for keyword in food_keywords):
        return 'Food & Dining'
    
    # Transportation
    transport_keywords = ['uber', 'lyft', 'taxi', 'gas', 'shell', 'esso', 'petro', 'parking', 'transit', 'go transit']
    if any(keyword in merchant_lower for keyword in transport_keywords):
        return 'Transportation'
    
    # Shopping
    shopping_keywords = ['walmart', 'costco', 'amazon', 'best buy', 'canadian tire', 'home depot', 'lowe']
    if any(keyword in merchant_lower for keyword in shopping_keywords):
        return 'Shopping'
    
    # Entertainment
    entertainment_keywords = ['netflix', 'spotify', 'movie', 'theatre', 'cinema', 'game', 'playstation', 'xbox']
    if any(keyword in merchant_lower for keyword in entertainment_keywords):
        return 'Entertainment'
    
    # Bills & Utilities
    bills_keywords = ['hydro', 'electric', 'water', 'gas', 'internet', 'phone', 'rogers', 'bell', 'telus']
    if any(keyword in merchant_lower for keyword in bills_keywords):
        return 'Bills & Utilities'
    
    # Health & Fitness
    health_keywords = ['pharmacy', 'shoppers', 'rexall', 'gym', 'fitness', 'medical', 'dental']
    if any(keyword in merchant_lower for keyword in health_keywords):
        return 'Health & Fitness'
    
    return 'Uncategorized'

@app.route('/')
def dashboard():
    # Get current month's purchases
    current_month = datetime.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    purchases = Purchase.query.filter(Purchase.date >= current_month).order_by(Purchase.date.desc()).all()
    
    # Calculate totals
    total_spent = sum(p.amount for p in purchases)
    
    # Get category breakdown
    categories = db.session.query(Purchase.category, db.func.sum(Purchase.amount)).filter(
        Purchase.date >= current_month
    ).group_by(Purchase.category).all()
    
    # Get recent purchases for the table
    recent_purchases = Purchase.query.order_by(Purchase.date.desc()).limit(10).all()
    day = date.today().day
    
    return render_template('dashboard.html', 
                         purchases=purchases,
                         total_spent=total_spent,
                         categories=categories,
                         recent_purchases=recent_purchases,
                         day=day)

@app.route('/sync-gmail')
def sync_gmail():
    try:
        # Get the date of the most recent purchase to avoid re-processing old emails
        last_purchase = Purchase.query.order_by(Purchase.date.desc()).first()
        since_date = None
        if last_purchase:
            # Get emails from 1 day before the last purchase to ensure we don't miss any
            since_date = last_purchase.date - timedelta(days=1)
        
        # Sync purchases from Gmail
        purchases = gmail_connector.get_purchases(since_date=since_date)
        new_purchases = 0
        skipped_purchases = 0
        
        for purchase_data in purchases:
            # More robust duplicate detection
            # Check for existing purchase with same date, merchant, amount, and description
            existing = Purchase.query.filter(
                Purchase.date == datetime.strptime(purchase_data['date'], "%B %d, %Y"),
                Purchase.merchant == purchase_data['merchant'],
                Purchase.amount == purchase_data['amount'],
            ).first()
            
            if not existing:
                # Auto-categorize the purchase
                auto_category = auto_categorize_purchase(
                    purchase_data['merchant'], 
                )
                
                purchase = Purchase(
                    date=datetime.strptime(purchase_data['date'], "%B %d, %Y"),
                    merchant=purchase_data['merchant'],
                    amount=purchase_data['amount'],
                    category=auto_category
                )
                db.session.add(purchase)
                new_purchases += 1
            else:
                skipped_purchases += 1
        db.session.commit()
        
        message = f'Sync completed: {new_purchases} new purchases added, {skipped_purchases} duplicates skipped'
        return jsonify({'success': True, 'message': message})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/purchases')
def purchases():
    page = request.args.get('page', 1, type=int)
    purchases = Purchase.query.order_by(Purchase.date.desc()).paginate(
        page=page, per_page=20, error_out=False)
    return render_template('purchases.html', purchases=purchases)

@app.route('/budgets')
def budgets():
    budgets = Budget.query.all()
    return render_template('budgets.html', budgets=budgets)

@app.route('/category-rules')
def category_rules():
    rules = CategoryRule.query.order_by(CategoryRule.priority.desc()).all()
    return render_template('category_rules.html', rules=rules)

@app.route('/api/purchases')
def api_purchases():
    purchases = Purchase.query.order_by(Purchase.date.desc()).limit(100).all()
    return jsonify([{
        'id': p.id,
        'date': p.date.strftime("%B %d, %Y"),
        'merchant': p.merchant,
        'amount': p.amount,
        'category': p.category,
    } for p in purchases])

@app.route('/api/purchases', methods=['POST'])
def create_purchase():
    try:
        data = request.json
        
        # Validate required fields
        if not data.get('date') or not data.get('merchant') or not data.get('amount'):
            return jsonify({'success': False, 'error': 'Missing required fields: date, merchant, amount'})
        
        # Parse and validate date
        try:
            purchase_date = datetime.strptime(data['date'], "%B %d, %Y")
        except ValueError:
            return jsonify({'success': False, 'error': 'Invalid date format.'})
        
        # Validate amount
        try:
            amount = float(data['amount'])
            if amount <= 0:
                return jsonify({'success': False, 'error': 'Amount must be greater than 0'})
        except (ValueError, TypeError):
            return jsonify({'success': False, 'error': 'Invalid amount'})
        
        # Create the purchase
        purchase = Purchase(
            date=purchase_date,
            merchant=data['merchant'].strip(),
            amount=amount,
            category=data.get('category', 'Uncategorized'),
        )
        
        db.session.add(purchase)
        db.session.commit()
        
        return jsonify({
            'success': True, 
            'message': f'Purchase added successfully: {purchase.merchant} - ${purchase.amount:.2f}',
            'id': purchase.id
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)})

@app.route('/api/purchases/<int:purchase_id>', methods=['GET'])
def get_purchase(purchase_id):
    """Get a single purchase by ID"""
    purchase = Purchase.query.get_or_404(purchase_id)
    return jsonify({
        'id': purchase.id,
        'date': purchase.date.strftime("%B %d, %Y"),
        'merchant': purchase.merchant,
        'amount': purchase.amount,
        'category': purchase.category,
    })

@app.route('/api/purchases/<int:purchase_id>', methods=['PUT'])
def update_purchase(purchase_id):
    purchase = Purchase.query.get_or_404(purchase_id)
    data = request.json
    
    if 'category' in data:
        purchase.category = data['category']
        
    db.session.commit()
    return jsonify({'success': True})

@app.route('/api/budgets', methods=['POST'])
def create_budget():
    data = request.json
    budget = Budget(
        category=data['category'],
        monthly_limit=float(data['monthly_limit'])
    )
    db.session.add(budget)
    db.session.commit()
    return jsonify({'success': True, 'id': budget.id})

@app.route('/api/budgets/<int:budget_id>', methods=['DELETE'])
def delete_budget(budget_id):
    budget = Budget.query.get_or_404(budget_id)
    db.session.delete(budget)
    db.session.commit()
    return jsonify({'success': True})

@app.route('/api/category-rules', methods=['GET'])
def get_category_rules():
    """Get all category rules"""
    rules = CategoryRule.query.order_by(CategoryRule.priority.desc()).all()
    return jsonify([{
        'id': rule.id,
        'merchant_pattern': rule.merchant_pattern,
        'category': rule.category,
        'priority': rule.priority
    } for rule in rules])

@app.route('/api/category-rules', methods=['POST'])
def create_category_rule():
    try:
        data = request.json
        rule = CategoryRule(
            merchant_pattern=data['merchant_pattern'],
            category=data['category'],
            priority=data.get('priority', 1)
        )
        db.session.add(rule)
        db.session.commit()
        return jsonify({'success': True, 'id': rule.id})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/api/category-rules/<int:rule_id>', methods=['DELETE'])
def delete_category_rule(rule_id):
    """Delete a category rule"""
    try:
        rule = CategoryRule.query.get_or_404(rule_id)
        db.session.delete(rule)
        db.session.commit()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/api/bulk-categorize', methods=['POST'])
def bulk_categorize():
    """Apply category to multiple purchases"""
    try:
        data = request.json
        purchase_ids = data.get('purchase_ids', [])
        category = data.get('category')
        
        if not purchase_ids or not category:
            return jsonify({'success': False, 'error': 'Missing purchase IDs or category'})
        
        # Update all specified purchases
        updated_count = Purchase.query.filter(Purchase.id.in_(purchase_ids)).update(
            {'category': category}, 
            synchronize_session=False
        )
        
        db.session.commit()
        
        return jsonify({
            'success': True, 
            'message': f'Updated {updated_count} purchases with category: {category}'
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/api/auto-categorize-all', methods=['POST'])
def auto_categorize_all():
    try:
        # Get all uncategorized purchases
        uncategorized = Purchase.query.filter(
            Purchase.category.in_(['Uncategorized', ''])
        ).all()
        
        updated_count = 0
        for purchase in uncategorized:
            new_category = auto_categorize_purchase(purchase.merchant)
            if new_category != 'Uncategorized':
                purchase.category = new_category
                updated_count += 1
        
        db.session.commit()
        
        return jsonify({
            'success': True, 
            'message': f'Auto-categorized {updated_count} purchases'
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

def migrate_database():
    """Handle database migrations for existing installations"""
    with app.app_context():
        # Check if the unique index exists
        inspector = db.inspect(db.engine)
        indexes = inspector.get_indexes('purchase')
        index_names = [index['name'] for index in indexes]
        
        if 'idx_unique_purchase' not in index_names:
            print("Creating unique index for purchases...")
            try:
                # Create the unique index
                db.engine.execute(
                    'CREATE UNIQUE INDEX idx_unique_purchase ON purchase (date, merchant, amount)'
                )
                print("Unique index created successfully!")
            except Exception as e:
                print(f"Warning: Could not create unique index: {e}")
                print("Duplicate prevention will rely on application logic only.")
        
        # Check if CategoryRule table exists
        tables = inspector.get_table_names()
        if 'category_rule' not in tables:
            print("Creating CategoryRule table...")
            try:
                db.create_all()
                print("CategoryRule table created successfully!")
            except Exception as e:
                print(f"Warning: Could not create CategoryRule table: {e}")
        
        # Create some default category rules if none exist
        if CategoryRule.query.count() == 0:
            print("Creating default category rules...")
            try:
                default_rules = [
                    CategoryRule(merchant_pattern='tim hortons', category='Food & Dining', priority=10),
                    CategoryRule(merchant_pattern='starbucks', category='Food & Dining', priority=10),
                    CategoryRule(merchant_pattern='subway', category='Food & Dining', priority=10),
                    CategoryRule(merchant_pattern='mcdonalds', category='Food & Dining', priority=10),
                    CategoryRule(merchant_pattern='shell', category='Transportation', priority=10),
                    CategoryRule(merchant_pattern='esso', category='Transportation', priority=10),
                    CategoryRule(merchant_pattern='uber', category='Transportation', priority=10),
                    CategoryRule(merchant_pattern='walmart', category='Shopping', priority=10),
                    CategoryRule(merchant_pattern='costco', category='Shopping', priority=10),
                    CategoryRule(merchant_pattern='amazon', category='Shopping', priority=10),
                    CategoryRule(merchant_pattern='rogers', category='Bills & Utilities', priority=10),
                    CategoryRule(merchant_pattern='bell', category='Bills & Utilities', priority=10),
                ]
                
                for rule in default_rules:
                    db.session.add(rule)
                
                db.session.commit()
                print(f"Created {len(default_rules)} default category rules!")
            except Exception as e:
                print(f"Warning: Could not create default rules: {e}")

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
        migrate_database()
    app.run(debug=True, host='0.0.0.0', port=5000)
