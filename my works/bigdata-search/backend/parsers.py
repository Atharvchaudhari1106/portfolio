import os
import json
import csv
import pandas as pd
import re

class DataParser:
    """
    Parses different file formats (JSON, CSV, Excel, TXT/PDF) and normalizes 
    them into a unified search format.
    """
    
    @staticmethod
    def parse_file(file_path):
        """
        Determines file type, parses it, and returns a list of normalized records.
        Each record matches the structure:
        {
            "id": str,
            "source_type": str,  # e.g., 'FIR', 'CAF', 'CDR', etc.
            "file_name": str,
            "raw_text": str,
            "metadata": dict,    # key-value pairs like name, phone, ip, bank_account
            "timestamp": str     # ISO date string or timestamp
        }
        """
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"File not found: {file_path}")
            
        ext = os.path.splitext(file_path)[1].lower()
        file_name = os.path.basename(file_path)
        
        # Deduce source type from filename if not embedded in data
        source_type = DataParser._deduce_source_type(file_name)
        
        records = []
        try:
            if ext == '.json':
                records = DataParser._parse_json(file_path, source_type, file_name)
            elif ext in ['.csv', '.txt']:
                # Basic check if TXT is actually a CSV
                records = DataParser._parse_csv(file_path, source_type, file_name)
            elif ext in ['.xlsx', '.xls']:
                records = DataParser._parse_excel(file_path, source_type, file_name)
            else:
                # Fallback to reading raw text (covers basic PDF text dumps or log files)
                records = DataParser._parse_raw_text(file_path, source_type, file_name)
        except Exception as e:
            print(f"Error parsing {file_name}: {str(e)}")
            # Fallback to raw parsing if specific parser fails
            try:
                records = DataParser._parse_raw_text(file_path, source_type, file_name)
            except Exception:
                pass
                
        return records

    @staticmethod
    def _deduce_source_type(file_name):
        name_upper = file_name.upper()
        if 'FIR' in name_upper: return 'FIR'
        if 'CAF' in name_upper: return 'CAF'
        if 'CDR' in name_upper: return 'CDR'
        if 'ILD' in name_upper or 'GATEWAY' in name_upper: return 'ILD GATEWAY'
        if '1930' in name_upper or 'TICKET' in name_upper: return '1930 TICKET DETAIL'
        if 'IPDR' in name_upper: return 'IPDR'
        if 'IP_INFO' in name_upper or 'IP INFORMATION' in name_upper: return 'IP INFORMATION'
        if 'GMAIL' in name_upper or 'GOOGLE_MAIL' in name_upper: return 'GMAIL DATA'
        if 'ANDROID' in name_upper or 'DEVICE' in name_upper: return 'ANDROID DEVICE CONFIGURATION'
        if 'APP_DETAILS' in name_upper or 'GOOGLE_APP' in name_upper: return 'APP DETAILS FROM GOOGLE'
        if 'FACEBOOK' in name_upper or 'FB' in name_upper: return 'FACEBOOK DETAIL'
        if 'INSTAGRAM' in name_upper or 'INSTA' in name_upper: return 'INSTAGRAM'
        if 'WHATSAPP' in name_upper or 'WA' in name_upper: return 'WHATSAPP'
        if 'MICROSOFT' in name_upper or 'OUTLOOK' in name_upper: return 'MICROSOFT MAIL DETAIL'
        if 'CEIR' in name_upper: return 'CEIR PORTAL'
        return 'UNSTRUCTURED'

    @staticmethod
    def _parse_json(file_path, source_type, file_name):
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            data = json.load(f)
            
        records = []
        # If it's a list of records
        if isinstance(data, list):
            items = data
        elif isinstance(data, dict):
            # If it's a nested dict, try to find a list or treat as single record
            if 'records' in data and isinstance(data['records'], list):
                items = data['records']
            elif 'data' in data and isinstance(data['data'], list):
                items = data['data']
            else:
                items = [data]
        else:
            items = [data]
            
        for i, item in enumerate(items):
            if not isinstance(item, dict):
                item = {"value": str(item)}
                
            raw_text = json.dumps(item, ensure_ascii=False)
            metadata = DataParser._clean_metadata(item)
            
            # Extract timestamp if available
            timestamp = item.get('timestamp') or item.get('date') or item.get('created_at') or ''
            
            rec_id = item.get('id') or item.get('record_id') or f"{source_type}_{file_name}_{i}"
            
            records.append({
                "id": str(rec_id),
                "source_type": item.get('source_type') or source_type,
                "file_name": file_name,
                "raw_text": raw_text,
                "metadata": metadata,
                "timestamp": str(timestamp)
            })
        return records

    @staticmethod
    def _parse_csv(file_path, source_type, file_name):
        records = []
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            # Try to sniff delimiter
            content = f.read(4096)
            f.seek(0)
            delimiter = ','
            if ';' in content and content.count(';') > content.count(','):
                delimiter = ';'
            elif '\t' in content:
                delimiter = '\t'
                
            reader = csv.DictReader(f, delimiter=delimiter)
            for i, row in enumerate(reader):
                raw_text = " | ".join([f"{k}: {v}" for k, v in row.items() if v])
                metadata = DataParser._clean_metadata(dict(row))
                
                timestamp = row.get('timestamp') or row.get('date') or row.get('date_time') or ''
                rec_id = row.get('id') or row.get('record_id') or f"{source_type}_{file_name}_{i}"
                
                records.append({
                    "id": str(rec_id),
                    "source_type": source_type,
                    "file_name": file_name,
                    "raw_text": raw_text,
                    "metadata": metadata,
                    "timestamp": str(timestamp)
                })
        return records

    @staticmethod
    def _parse_excel(file_path, source_type, file_name):
        records = []
        # read all sheets
        xl = pd.ExcelFile(file_path)
        for sheet_name in xl.sheet_names:
            df = xl.parse(sheet_name)
            # Replace NaN with empty string
            df = df.fillna('')
            for i, row in df.iterrows():
                row_dict = row.to_dict()
                raw_text = f"Sheet: {sheet_name} | " + " | ".join([f"{k}: {v}" for k, v in row_dict.items() if v != ''])
                metadata = DataParser._clean_metadata(row_dict)
                
                timestamp = row_dict.get('timestamp') or row_dict.get('date') or row_dict.get('date_time') or ''
                rec_id = row_dict.get('id') or row_dict.get('record_id') or f"{source_type}_{file_name}_{sheet_name}_{i}"
                
                records.append({
                    "id": str(rec_id),
                    "source_type": source_type,
                    "file_name": file_name,
                    "raw_text": raw_text,
                    "metadata": metadata,
                    "timestamp": str(timestamp)
                })
        return records

    @staticmethod
    def _parse_raw_text(file_path, source_type, file_name):
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
            
        # Treat entire file or individual lines as records based on size
        lines = [line.strip() for line in content.split('\n') if line.strip()]
        
        # If it looks like a log file with many lines
        if len(lines) > 20 and source_type in ['ILD GATEWAY', 'IPDR']:
            records = []
            for i, line in enumerate(lines):
                # Try to parse line values via regex
                metadata = DataParser._extract_entities_from_text(line)
                records.append({
                    "id": f"{source_type}_{file_name}_{i}",
                    "source_type": source_type,
                    "file_name": file_name,
                    "raw_text": line,
                    "metadata": metadata,
                    "timestamp": metadata.get('timestamp', '')
                })
            return records
        else:
            # Treat as single document (e.g. single FIR report, config text, etc.)
            metadata = DataParser._extract_entities_from_text(content)
            return [{
                "id": f"{source_type}_{file_name}",
                "source_type": source_type,
                "file_name": file_name,
                "raw_text": content,
                "metadata": metadata,
                "timestamp": metadata.get('timestamp', '')
            }]

    @staticmethod
    def _clean_metadata(item):
        """Standardizes keys and cleans values for indexing."""
        cleaned = {}
        for k, v in item.items():
            if k is None or v == '':
                continue
            k_lower = str(k).lower().replace(" ", "_").replace(".", "_")
            cleaned[k_lower] = str(v).strip()
            
        # Extract further entity fields using regex if missing
        raw_dump = " ".join([str(val) for val in cleaned.values()])
        entities = DataParser._extract_entities_from_text(raw_dump)
        
        # Merge, preferring explicit keys in original item
        for ent_k, ent_v in entities.items():
            if ent_k not in cleaned or not cleaned[ent_k]:
                cleaned[ent_k] = ent_v
                
        return cleaned

    @staticmethod
    def _extract_entities_from_text(text):
        """Regex extractor to pull typical identifiers out of unstructured text."""
        entities = {}
        
        # 1. Phone number (Indian 10-digit, ignoring country code)
        phone_matches = re.findall(r'(?:\+91|91)?[6-9]\d{9}\b', text)
        if phone_matches:
            # Clean and take unique ones
            phones = list(set([re.sub(r'^\+91|^91', '', p) for p in phone_matches]))
            entities['mobile_no'] = phones[0]
            if len(phones) > 1:
                entities['additional_mobiles'] = phones
                
        # 2. Email Address
        email_matches = re.findall(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', text)
        if email_matches:
            emails = list(set(email_matches))
            entities['mail_id'] = emails[0]
            if len(emails) > 1:
                entities['additional_emails'] = emails
                
        # 3. IP Address (IPv4)
        ip_matches = re.findall(r'\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b', text)
        if ip_matches:
            ips = list(set(ip_matches))
            entities['ip_address'] = ips[0]
            if len(ips) > 1:
                entities['additional_ips'] = ips
                
        # 4. Aadhar Card (12 digits, can have spaces or hyphens)
        aadhar_matches = re.findall(r'\b\d{4}\s?\d{4}\s?\d{4}\b', text)
        if aadhar_matches:
            entities['aadhar'] = re.sub(r'\s', '', aadhar_matches[0])
            
        # 5. PAN Card (5 letters, 4 digits, 1 letter)
        pan_matches = re.findall(r'\b[A-Z]{5}[0-9]{4}[A-Z]\b', text.upper())
        if pan_matches:
            entities['pan'] = pan_matches[0]
            
        # 6. Passport Number (Letter + 7 digits)
        passport_matches = re.findall(r'\b[A-Z][0-9]{7}\b', text.upper())
        if passport_matches:
            entities['passport'] = passport_matches[0]
            
        # 7. Bank Account Number (typically 9-18 digits)
        # We look for contexts like "A/C", "Account", "AC" near a number block
        bank_matches = re.findall(r'\b\d{9,18}\b', text)
        if bank_matches:
            # Check context
            if any(term in text.lower() for term in ['ac', 'account', 'bank', 'acc', 'a/c']):
                entities['bank_account_no'] = bank_matches[0]
                
        # 8. IFSC Code (4 letters, 0, 6 alphanumeric/digits)
        ifsc_matches = re.findall(r'\b[A-Z]{4}0[A-Z0-9]{6}\b', text.upper())
        if ifsc_matches:
            entities['ifsc_code'] = ifsc_matches[0]
            
        # 9. IMEI Number (15 digits)
        imei_matches = re.findall(r'\b\d{15}\b', text)
        if imei_matches:
            entities['imei_no'] = imei_matches[0]
            
        # 10. Date of Birth / Dates (e.g. DD-MM-YYYY or YYYY-MM-DD)
        date_matches = re.findall(r'\b\d{2}[-/]\d{2}[-/]\d{4}\b|\b\d{4}[-/]\d{2}[-/]\d{2}\b', text)
        if date_matches:
            entities['date'] = date_matches[0]
            if 'dob' in text.lower() or 'birth' in text.lower():
                entities['dob'] = date_matches[0]

        # 11. PIN Code (Indian 6-digit)
        pin_matches = re.findall(r'\b[1-9][0-9]{5}\b', text)
        if pin_matches:
            entities['pin_code'] = pin_matches[0]

        # 12. Cell ID
        cell_matches = re.findall(r'\b\d{5}-\d{5}\b|\bcell\s*(?:id)?\s*:?\s*([a-fA-F0-9]+)\b', text, re.IGNORECASE)
        if cell_matches:
            entities['cell_id'] = cell_matches[0] if isinstance(cell_matches[0], str) else cell_matches[0][0]

        return entities
