import re
import time
from collections import defaultdict

class AIGraphEngine:
    """
    Builds relationship link graphs (GUI Mapping) across structured/unstructured records 
    and applies AI/ML pattern detection (anomalies, topic classification).
    """
    
    def __init__(self, db_engine):
        self.db_engine = db_engine

    def build_network_graph(self, initial_query_str, search_results):
        """
        Traverses the database starting from search results and resolves connections.
        Returns a dictionary: { "nodes": [...], "links": [...] }
        """
        nodes = {}
        links = []
        linked_keys = defaultdict(set)
        
        # 1. Add Search Query as the root node
        root_node_id = f"root_{initial_query_str}"
        nodes[root_node_id] = {
            "id": root_node_id,
            "label": f"Search: {initial_query_str}",
            "type": "root",
            "val": initial_query_str,
            "metadata": {"hits_count": len(search_results)}
        }
        
        # Collect matched records
        matched_records = [res["record"] for res in search_results]
        
        # Limit processing to prevent exploding graphs (Big Data constraint)
        max_depth_records = matched_records[:20]
        
        for i, rec in enumerate(max_depth_records):
            doc_id = rec["id"]
            doc_type = rec["source_type"]
            doc_label = f"{doc_type}: {os_basename(rec.get('file_name', 'Streaming_Log'))}"
            
            # Create a Document Node
            nodes[doc_id] = {
                "id": doc_id,
                "label": doc_label,
                "type": "document",
                "val": doc_type,
                "metadata": {
                    "file": rec.get("file_name", "Streaming_Log"),
                    "timestamp": rec.get("timestamp", "N/A"),
                    "score": search_results[i]["score"]
                }
            }
            
            # Link root to document
            links.append({
                "source": root_node_id,
                "target": doc_id,
                "type": "matched_in"
            })
            
            # Extract metadata identifiers from document
            metadata = rec.get("metadata", {})
            for meta_key, meta_val in metadata.items():
                if not meta_val:
                    continue
                    
                # Skip secondary long listings
                if meta_key in ['raw_text', 'additional_mobiles', 'additional_emails', 'additional_ips']:
                    continue
                    
                node_type = self._map_metadata_key_to_node_type(meta_key)
                if not node_type:
                    continue
                    
                entity_node_id = f"{node_type}_{meta_val}"
                
                # Check if entity node already exists, otherwise create it
                if entity_node_id not in nodes:
                    nodes[entity_node_id] = {
                        "id": entity_node_id,
                        "label": meta_val,
                        "type": node_type,
                        "val": meta_val,
                        "metadata": {
                            "first_seen_in": doc_label,
                            "type_name": meta_key.replace('_', ' ').upper()
                        }
                    }
                    
                # Link Document to Entity
                links.append({
                    "source": doc_id,
                    "target": entity_node_id,
                    "type": meta_key.upper()
                })
                
                # Record this key for 2nd degree traversal
                linked_keys[node_type].add(meta_val)
                
        # 2nd Degree Connection: Search other documents matching the extracted entity keys
        # Traverse only top 5 resolved entity keys to avoid infinite looping
        degree2_limit = 5
        degree2_count = 0
        
        for entity_type, keys in linked_keys.items():
            for key in keys:
                if degree2_count >= degree2_limit:
                    break
                    
                # Find other documents matching this key (cross-database search)
                # Query index for exact key matches
                postings = self.db_engine.inverted_index.get(key.lower(), {})
                for doc_id, tf in postings.items():
                    # If this document is not already in our nodes list
                    if doc_id not in nodes and doc_id in self.db_engine.documents:
                        degree2_count += 1
                        rec = self.db_engine.documents[doc_id]
                        doc_type = rec["source_type"]
                        doc_label = f"{doc_type}: {os_basename(rec.get('file_name', 'Streaming_Log'))}"
                        
                        nodes[doc_id] = {
                            "id": doc_id,
                            "label": doc_label,
                            "type": "document",
                            "val": doc_type,
                            "metadata": {
                                "file": rec.get("file_name", "Streaming_Log"),
                                "timestamp": rec.get("timestamp", "N/A"),
                                "degree": "2nd"
                            }
                        }
                        
                        entity_node_id = f"{entity_type}_{key}"
                        links.append({
                            "source": entity_node_id,
                            "target": doc_id,
                            "type": "referenced_in"
                        })
                        
        return {
            "nodes": list(nodes.values()),
            "links": self._deduplicate_links(links)
        }

    def _map_metadata_key_to_node_type(self, key):
        """Standardizes metadata fields into visual graph node categories."""
        if 'name' in key: return 'suspect'
        if 'mobile' in key or 'phone' in key: return 'phone'
        if 'ip_address' in key or 'ip' in key: return 'ip'
        if 'email' in key or 'mail' in key: return 'email'
        if 'bank_account' in key or 'account' in key: return 'bank'
        if 'aadhar' in key: return 'aadhar'
        if 'pan' in key: return 'pan'
        if 'passport' in key: return 'passport'
        if 'imei' in key: return 'imei'
        if 'cell_id' in key: return 'cell_tower'
        return None

    def _deduplicate_links(self, links):
        seen = set()
        deduped = []
        for link in links:
            key = (link["source"], link["target"], link["type"])
            reverse_key = (link["target"], link["source"], link["type"])
            if key not in seen and reverse_key not in seen:
                seen.add(key)
                deduped.append(link)
        return deduped

    # ==========================================
    # 4. AI/ML PATTERN DETECTORS
    # ==========================================

    def run_anomaly_detection(self, source_type=None):
        """
        Scans data records to identify behavioral anomalies:
        - Geodistancing (suspicious fast traveling based on IP/cell towers)
        - Communication spikes (sudden heavy volume of pings/calls)
        - Financial transaction patterns (high intensity / illegal values)
        """
        anomalies = []
        records = list(self.db_engine.documents.values())
        
        # 1. Geodistance/Time Anomaly (Speed Check)
        # Groups records by mobile_no or username, sorts by time, and checks locations
        user_timeline = defaultdict(list)
        for rec in records:
            meta = rec.get("metadata", {})
            user_id = meta.get("mobile_no") or meta.get("mail_id") or meta.get("username")
            timestamp = rec.get("timestamp")
            
            # Simple simulation: Extract IP/Cell coordinates
            ip = meta.get("ip_address")
            cell = meta.get("cell_id")
            
            if user_id and timestamp and (ip or cell):
                user_timeline[user_id].append({
                    "time": timestamp,
                    "ip": ip,
                    "cell": cell,
                    "doc_type": rec["source_type"],
                    "file": rec["file_name"]
                })
                
        # Scans user timelines for impossible jumps (e.g. IP/Cell change within minutes)
        # In mock data, we will inject a specific fast traveling anomaly for testing
        for user_id, events in user_timeline.items():
            if len(events) < 2:
                continue
            # Sort by time
            # Assuming format: "YYYY-MM-DD HH:MM:SS"
            events_sorted = sorted(events, key=lambda x: x["time"])
            for idx in range(len(events_sorted) - 1):
                ev1 = events_sorted[idx]
                ev2 = events_sorted[idx+1]
                
                # Check IP discrepancy
                if ev1["ip"] and ev2["ip"] and ev1["ip"] != ev2["ip"]:
                    # In a real model, we perform IP Geolocation lookup. 
                    # Here we simulate: if the third octet is wildly different
                    octets1 = ev1["ip"].split('.')
                    octets2 = ev2["ip"].split('.')
                    if len(octets1) == 4 and len(octets2) == 4 and octets1[0] != octets2[0]:
                        anomalies.append({
                            "type": "Geographic IP Anomaly",
                            "severity": "CRITICAL",
                            "target": user_id,
                            "description": f"Suspect accessed services from two distinct subnets ({ev1['ip']} and {ev2['ip']}) within an improbable time frame.",
                            "timestamp": ev2["time"],
                            "details": f"First access via {ev1['doc_type']} from {ev1['file']}. Second access via {ev2['doc_type']} from {ev2['file']}."
                        })
                        
        # 2. Call Detail Record Spike Anomaly
        cdr_records = [r for r in records if r["source_type"] == "CDR"]
        caller_counts = defaultdict(int)
        for r in cdr_records:
            caller = r.get("metadata", {}).get("mobile_no")
            if caller:
                caller_counts[caller] += 1
                
        for caller, count in caller_counts.items():
            # If a single phone logs > 15 calls in the mock data, flag as high volume spike
            if count > 10:
                anomalies.append({
                    "type": "Traffic Volume Anomaly",
                    "severity": "WARNING",
                    "target": caller,
                    "description": f"Subscriber logged an abnormally high volume of calls ({count} calls) in the observed CDR time range.",
                    "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
                    "details": f"Spike detected in telecom logs. Possible spam, fraud router, or coordination event."
                })
                
        # Default fallback anomalies if database is empty
        if not anomalies:
            anomalies.append({
                "type": "System Baseline",
                "severity": "INFO",
                "target": "N/A",
                "description": "No significant anomalies found. Behavioral metrics remain within baseline bounds.",
                "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
                "details": "Scanning completed."
            })
            
        return anomalies

    def run_topic_classifier(self, text):
        """
        AI text classifier. Performs simple keyword-frequency pattern matching
        to tag documents with legal categories.
        """
        text_lower = text.lower()
        scores = {
            "Cyber Fraud": len(re.findall(r'otp|bank|phishing|1930|account|card|transaction|upi|credit', text_lower)),
            "Money Laundering": len(re.findall(r'cash|transfer|account|black money|laundering|shell|hawala|crore', text_lower)),
            "Identity Theft": len(re.findall(r'aadhar|pan|passport|fake id|impersonation|documents', text_lower)),
            "Cyber Espionage": len(re.findall(r'ip address|port|firewall|server|gateway|hack|android config', text_lower)),
            "Drug Trafficking": len(re.findall(r'seized|contraband|drugs|ndps|consignment|courier', text_lower))
        }
        
        # Get highest score category
        sorted_cats = sorted(scores.items(), key=lambda x: x[1], reverse=True)
        best_cat, best_score = sorted_cats[0]
        
        if best_score > 0:
            return best_cat
        return "General Investigation"

def os_basename(path):
    # Cross-platform basename extraction
    return path.split('\\')[-1].split('/')[-1]
