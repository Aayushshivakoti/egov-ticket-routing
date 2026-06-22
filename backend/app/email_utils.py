import logging
import os

logger = logging.getLogger("app.email_utils")

def send_mock_email(to_email: str, subject: str, body: str):
    email_content = f"""
========================================
MOCK EMAIL SENT TO: {to_email}
SUBJECT: {subject}
BODY:
{body}
========================================
"""
    logger.info(email_content)
    print(email_content)
    
    # Write to a persistent log file in the workspace root for verification
    script_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    log_file_path = os.path.join(script_dir, "..", "mock_emails.log")
    try:
        with open(log_file_path, "a", encoding="utf-8") as f:
            f.write(email_content)
    except Exception as e:
        print(f"Failed to write mock email log: {e}")
