import os.path
import base64
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow, Flow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from datetime import datetime
import re

# If modifying these scopes, delete the file token.json.
SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"]


class GmailConnector:
    def __init__(self):
        self.creds = None
        self.service = None
        self._authenticate()
    
    def _authenticate(self):
        """Authenticate with Gmail API"""
        # The file token.json stores the user's access and refresh tokens, and is
        # created automatically when the authorization flow completes for the first
        # time.
        if os.path.exists("./token.json"):
            self.creds = Credentials.from_authorized_user_file("./token.json", SCOPES)
        
        # If there are no (valid) credentials available, let the user log in.
        if not self.creds or not self.creds.valid:
            if self.creds and self.creds.expired and self.creds.refresh_token:
                self.creds.refresh(Request())
            else:
                flow = InstalledAppFlow.from_client_secrets_file(
                    "credentials.json", SCOPES
                )
                self.creds = flow.run_local_server(port=0)
            
            # Save the credentials for the next run
            with open("token.json", "w") as token:
                token.write(self.creds.to_json())
        
        try:
            self.service = build("gmail", "v1", credentials=self.creds)
        except HttpError as error:
            print(f"An error occurred: {error}")
            raise
    
    def get_purchases(self, max_msgs=50, since_date=None):
        """Extract purchase information from Gmail messages"""
        if not self.service:
            raise Exception("Gmail service not initialized")
        
        # Build query to filter emails
        query = "from:info@account.pcfinancial.ca"
        if since_date:
            # Only get emails since the last sync date
            query += f" after:{since_date.strftime('%Y/%m/%d')}"
        
        results = self.service.users().messages().list(
            userId='me', 
            maxResults=max_msgs, 
            q=query
        ).execute()
        
        messages = results.get('messages', [])
        if not messages:
            print("No new messages found.")
            return []
        
        purchases = []
        for msg in messages:
            try:
                msg_data = self.service.users().messages().get(
                    userId='me', 
                    id=msg['id'], 
                    format='full'
                ).execute()
                
                headers = msg_data.get("payload", {}).get("headers", [])
                subject = next((h['value'] for h in headers if h['name'] == 'Subject'), "No subject")
                
                # Check if this is a purchase notification
                if "PC" in subject and "purchase" in subject:
                    purchase_data = self._extract_purchase_data(msg_data)
                    if purchase_data:
                        purchases.append(purchase_data)
            except Exception as e:
                print(f"Error processing message {msg['id']}: {e}")
                continue
        
        return purchases
    
    def _extract_purchase_data(self, msg_data):
        try:
            payload = msg_data['payload']
            body_data = None
            
            # Extract email body
            if 'parts' in payload:
                for part in payload['parts']:
                    if part['mimeType'] == 'text/plain':
                        body_data = part['body'].get('data')
            else:
                body_data = payload['body'].get('data')
            
            if not body_data:
                return None
            
            decoded_body = base64.urlsafe_b64decode(body_data).decode('utf-8')
            email_content = decoded_body.split("\r\n")
            
            if len(email_content) >= 12:
                merchant = email_content[9].split(":")[1].strip()
                amount_str = email_content[10].strip()
                date_str = email_content[11].split(":")[1].strip()
                amount = float(re.sub(r'[^\d.]', '', amount_str))
                
                return {
                    'date': date_str,
                    'merchant': merchant,
                    'amount': amount,
                }
        
        except Exception as e:
            print(f"Error extracting purchase data: {e}")
            return None
    
    def read_emails(self, max_msgs=20):
        purchases = self.get_purchases(max_msgs)
        for purchase in purchases:
            print([purchase['date'], purchase['merchant'], purchase['amount']])
        return purchases


def main():
    """Main function for standalone execution"""
    connector = GmailConnector()
    connector.read_emails(50)


if __name__ == "__main__":
    main()
