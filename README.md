# Budget Monitor - Gmail Connector

A web application that automatically extracts Mastercard purchase notifications from Gmail and provides comprehensive budget monitoring and spending analysis.

## Features

- **Automatic Gmail Sync**: Connects to your Gmail account to extract PC Financial purchase notifications
- **Dashboard Overview**: Visual representation of spending patterns with charts and statistics
- **Purchase Management**: View, edit, and categorize all your purchases
- **Budget Tracking**: Set monthly budget limits for different spending categories
- **Real-time Updates**: Sync with Gmail to get the latest purchase data
- **Export Functionality**: Download purchase data as CSV for external analysis
- **Responsive Design**: Modern, mobile-friendly web interface

## Prerequisites

- Python 3.7 or higher
- Gmail account with PC Financial purchase notifications
- Google Cloud Project with Gmail API enabled

## Setup Instructions

### 1. Google Cloud Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Gmail API for your project
4. Go to "Credentials" and create an OAuth 2.0 Client ID
5. Download the credentials file and rename it to `credentials.json`
6. Place `credentials.json` in the project root directory

### 2. Install Dependencies

```bash
# Create and activate virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install required packages
pip install -r requirements.txt
```

### 3. First Run Authentication

1. Run the application for the first time:
   ```bash
   python app.py
   ```

2. Open your browser and go to `http://localhost:5000`
3. Click "Sync Gmail" in the sidebar
4. This will open a Google OAuth consent screen
5. Grant permissions to access your Gmail
6. A `token.json` file will be created for future authentication

### 4. Run the Application

```bash
python app.py
```

The application will be available at `http://localhost:5000`

## Usage

### Dashboard
- View spending overview for the current month
- See spending breakdown by category with interactive charts
- Monitor recent purchases
- Track daily spending averages

### Purchases
- Browse all purchases with pagination
- Search and filter purchases by category
- Edit purchase categories and descriptions
- Export purchase data to CSV

### Budgets
- Set monthly spending limits for different categories
- Monitor progress towards budget goals
- Visual progress bars with color coding
- Track remaining budget amounts



## Configuration

### Customizing Email Parsing

The application is configured to parse PC Financial purchase notifications. If you need to modify the email parsing logic:

1. Edit the `_extract_purchase_data` method in `connector.py`
2. Adjust the email content parsing indices based on your email format
3. Modify the date parsing format if needed

### Adding New Categories

To add new spending categories:

1. Edit the category options in the HTML templates
2. Update the database schema if needed
3. Restart the application

## Troubleshooting

### Common Issues

1. **Authentication Errors**: Delete `token.json` and re-authenticate
2. **No Purchases Found**: Check that your Gmail contains PC Financial purchase notifications
3. **Database Errors**: Delete `budget.db` to reset the database
4. **Import Errors**: Verify that `credentials.json` is in the correct location

### Gmail API Quotas

- Gmail API has daily quotas for API calls
- The application is designed to minimize API usage
- Consider implementing caching for production use

## Security Notes

- Keep `credentials.json` and `token.json` secure
- Don't commit these files to version control
- The application runs locally and doesn't expose data externally
- Consider using environment variables for sensitive configuration in production

## License

This project is for personal use. Please ensure compliance with Google's API terms of service and your financial institution's data usage policies.
