import os
import re
import math
import time
import queue
import threading
from concurrent.futures import ThreadPoolExecutor
from collections import defaultdict
import json
from backend.parsers import DataParser

INDEX_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'index_store.json')

class BigDataEngine:
    """
    Simulates a high-performance Big Data search and streaming framework,
    combining an Inverted Index (Elasticsearch), MapReduce (Spark), and Queueing (Kafka).
    """
    def __init__(self):
        self.lock = threading.Lock()
        
        # In-memory document database (MongoDB simulator)
        # format: { doc_id: { record_data } }
        self.documents = {}
        
        # Elasticsearch-style Inverted Index: { term: { doc_id: term_frequency } }
        self.inverted_index = defaultdict(dict)
        
        # Document frequencies for TF-IDF: { term: count_of_docs }
        self.doc_frequencies = defaultdict(int)
        
        # Kafka Stream Simulator variables
        self.kafka_queue = queue.Queue()
        self.streaming_active = False
        self.streaming_thread = None
        self.stream_history = []
        self.stream_stats = {
            "bytes_processed": 0,
            "records_processed": 0,
            "throughput_rec_per_sec": 0,
            "start_time": time.time()
        }
        
        # Load serialized index if exists
        self.load_index()

    # ==========================================
    # 1. SPARK MAPREDUCE FILE INGESTION PIPELINE
    # ==========================================
    
    def ingest_files_spark(self, file_paths):
        """
        Uses ThreadPoolExecutor to simulate a Spark MapReduce pipeline
        for parsing and indexing files in parallel.
        """
        print(f"[Spark Engine] Initializing MapReduce job for {len(file_paths)} files...")
        start_time = time.time()
        
        # Map phase: Process files in parallel threads
        map_results = []
        with ThreadPoolExecutor(max_workers=min(4, len(file_paths) or 1)) as executor:
            futures = [executor.submit(self._map_file, fp) for fp in file_paths]
            for fut in futures:
                res = fut.result()
                if res:
                    map_results.append(res)
                    
        # Reduce phase: Merge local indexes and records into the main index
        self._reduce_and_merge(map_results)
        
        elapsed = time.time() - start_time
        print(f"[Spark Engine] Job completed in {elapsed:.4f}s. Total records: {len(self.documents)}")
        return {
            "elapsed_seconds": elapsed,
            "files_processed": len(file_paths),
            "records_total": len(self.documents)
        }

    def _map_file(self, file_path):
        """
        Map Task: Parses a single file and creates local records and local index.
        """
        try:
            print(f"[Spark Mapper] Processing file: {os.path.basename(file_path)}")
            records = DataParser.parse_file(file_path)
            
            # Build local inverted index for this file
            local_index = defaultdict(int)
            local_records = {}
            
            for rec in records:
                doc_id = rec["id"]
                local_records[doc_id] = rec
                
                # Tokenize raw text
                terms = self._tokenize(rec["raw_text"])
                for term in terms:
                    local_index[(term, doc_id)] += 1
                    
            return {
                "records": local_records,
                "local_index": local_index,
                "file_size": os.path.getsize(file_path) if os.path.exists(file_path) else 0
            }
        except Exception as e:
            print(f"[Spark Mapper Error] Failed mapping {file_path}: {e}")
            return None

    def _reduce_and_merge(self, map_results):
        """
        Reduce Task: Aggregates records and merges indices into the global thread-safe state.
        """
        with self.lock:
            for result in map_results:
                if not result:
                    continue
                # Merge records (MongoDB JSON store)
                self.documents.update(result["records"])
                
                # Merge local indexes into the global inverted index
                for (term, doc_id), freq in result["local_index"].items():
                    # If this is a new term for this document, increment Document Frequency
                    if doc_id not in self.inverted_index[term]:
                        self.doc_frequencies[term] += 1
                    self.inverted_index[term][doc_id] = freq
                    
                # Update Kafka/streaming stats
                self.stream_stats["bytes_processed"] += result["file_size"]
                self.stream_stats["records_processed"] += len(result["records"])
            
            # Save index to disk after MapReduce reduction completes
            self.save_index()

    # ==========================================
    # 2. KAFKA STREAMING PIPELINE
    # ==========================================
    
    def start_kafka_stream(self, callback_func=None):
        """Starts a background thread that pulls records from Kafka queue and indexes them."""
        if self.streaming_active:
            return
            
        self.streaming_active = True
        self.stream_stats["start_time"] = time.time()
        
        def worker():
            print("[Kafka Broker] Stream listener started.")
            last_stats_time = time.time()
            records_in_interval = 0
            
            while self.streaming_active:
                try:
                    # Non-blocking get from queue
                    record = self.kafka_queue.get(timeout=0.5)
                    
                    # Process record (index it in near-real-time)
                    self._index_single_record(record)
                    
                    records_in_interval += 1
                    
                    # Track log history
                    self.stream_history.append({
                        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
                        "record_id": record["id"],
                        "source": record["source_type"],
                        "message": f"Ingested record with keys: {list(record['metadata'].keys())[:3]}"
                    })
                    
                    if len(self.stream_history) > 100:
                        self.stream_history.pop(0)
                        
                    if callback_func:
                        callback_func(record)
                        
                    self.kafka_queue.task_done()
                except queue.Empty:
                    # Periodic throughput update when idle
                    now = time.time()
                    if now - last_stats_time >= 1.0:
                        with self.lock:
                            self.stream_stats["throughput_rec_per_sec"] = round(records_in_interval / (now - last_stats_time), 1)
                            records_in_interval = 0
                            last_stats_time = now
                    continue
                except Exception as e:
                    print(f"[Kafka Broker Error] Ingestion error: {e}")
                    
        self.streaming_thread = threading.Thread(target=worker, daemon=True)
        self.streaming_thread.start()

    def stop_kafka_stream(self):
        self.streaming_active = False
        if self.streaming_thread:
            self.streaming_thread.join(timeout=2.0)
            
    def produce_to_kafka(self, records):
        """Pushes records into the Kafka stream."""
        for rec in records:
            # Add metadata keys if not present
            if "id" not in rec:
                rec["id"] = f"KAFKA_{int(time.time()*1000)}"
            if "raw_text" not in rec:
                rec["raw_text"] = json.dumps(rec.get("metadata", {}))
            self.kafka_queue.put(rec)

    def _index_single_record(self, record):
        """Indexes a single streaming record on-the-fly."""
        doc_id = record["id"]
        with self.lock:
            self.documents[doc_id] = record
            terms = self._tokenize(record["raw_text"])
            for term in terms:
                if doc_id not in self.inverted_index[term]:
                    self.doc_frequencies[term] += 1
                self.inverted_index[term][doc_id] = self.inverted_index[term].get(doc_id, 0) + 1
            self.stream_stats["records_processed"] += 1
            
            # Save index to disk after indexing single streaming record
            self.save_index()

    def save_index(self):
        """Serializes the engine search state to index_store.json on disk."""
        try:
            serialized_data = {
                "documents": self.documents,
                "inverted_index": {term: dict(postings) for term, postings in self.inverted_index.items()},
                "doc_frequencies": dict(self.doc_frequencies),
                "stream_stats": {
                    "bytes_processed": self.stream_stats["bytes_processed"],
                    "records_processed": self.stream_stats["records_processed"]
                }
            }
            with open(INDEX_PATH, 'w', encoding='utf-8') as f:
                json.dump(serialized_data, f, indent=2)
            print("[BigDataEngine] Search index successfully saved to disk.")
        except Exception as e:
            print(f"[BigDataEngine Error] Failed serializing index: {e}")

    def load_index(self):
        """Loads search index from index_store.json if it exists."""
        if not os.path.exists(INDEX_PATH):
            print("[BigDataEngine] No index file found on disk. Initializing empty search cluster.")
            return
            
        try:
            with open(INDEX_PATH, 'r', encoding='utf-8') as f:
                data = json.load(f)
                
            self.documents = data.get("documents", {})
            
            # Reconstruct defaultdict(dict) for inverted_index
            self.inverted_index = defaultdict(dict)
            raw_index = data.get("inverted_index", {})
            for term, postings in raw_index.items():
                self.inverted_index[term] = postings
                
            # Reconstruct doc_frequencies
            self.doc_frequencies = defaultdict(int, data.get("doc_frequencies", {}))
            
            # Load stats
            saved_stats = data.get("stream_stats", {})
            self.stream_stats["bytes_processed"] = saved_stats.get("bytes_processed", 0)
            self.stream_stats["records_processed"] = saved_stats.get("records_processed", 0)
            
            print(f"[BigDataEngine] Loaded search index from disk: {len(self.documents)} records, {len(self.inverted_index)} distinct terms.")
        except Exception as e:
            print(f"[BigDataEngine Error] Failed loading index: {e}. Initializing empty.")

    # ==========================================
    # 3. ELASTICSEARCH SEARCH ENGINE
    # ==========================================

    def search(self, query_str, query_type='natural', limit=50):
        """
        Performs searches using different paradigms:
        - Boolean: parses AND, OR, NOT operators.
        - Regex: compiles regex patterns and runs against records.
        - Natural: TF-IDF and Cosine similarity scoring.
        """
        if not query_str:
            return []
            
        start_time = time.time()
        
        if query_type == 'boolean':
            matched_ids = self._search_boolean(query_str)
            # Rank matches by standard text term overlap
            results = self._score_docs_by_term_overlap(matched_ids, query_str)
        elif query_type == 'regex':
            matched_ids = self._search_regex(query_str)
            results = self._score_docs_by_term_overlap(matched_ids, query_str)
        else:  # Natural Language / Semantic / TF-IDF
            results = self._search_tfidf(query_str)
            
        # Format output records
        formatted_results = []
        for doc_id, score in results[:limit]:
            doc = self.documents[doc_id]
            formatted_results.append({
                "record": doc,
                "score": round(score * 100, 2), # convert to percentage
                "highlights": self._generate_highlight(doc["raw_text"], query_str, query_type)
            })
            
        latency = (time.time() - start_time) * 1000 # ms
        return {
            "results": formatted_results,
            "total_hits": len(results),
            "latency_ms": round(latency, 2)
        }

    def _tokenize(self, text):
        """Splits text into cleaned lowercase terms."""
        return re.findall(r'\b[a-zA-Z0-9_]+\b', text.lower())

    def _score_docs_by_term_overlap(self, doc_ids, query_str):
        """Calculates a basic match score (0.0 to 1.0) based on query term frequency in doc."""
        terms = self._tokenize(query_str)
        if not terms:
            return [(d_id, 1.0) for d_id in doc_ids]
            
        scores = []
        for d_id in doc_ids:
            doc_text = self.documents[d_id]["raw_text"].lower()
            matches = sum(1 for term in terms if term in doc_text)
            score = matches / len(terms)
            scores.append((d_id, max(score, 0.05)))
            
        return sorted(scores, key=lambda x: x[1], reverse=True)

    def _search_regex(self, pattern_str):
        """Compiles regex and runs it across all stored records."""
        try:
            pattern = re.compile(pattern_str, re.IGNORECASE)
        except Exception:
            return []
            
        matched_ids = []
        for doc_id, doc in self.documents.items():
            if pattern.search(doc["raw_text"]):
                matched_ids.append(doc_id)
        return matched_ids

    def _search_boolean(self, query_str):
        """
        Parses boolean queries supporting AND, OR, NOT, and brackets.
        Example: "delhi AND (fraud OR complaint) AND NOT verified"
        Uses a simple recursive descent expression evaluator.
        """
        # Tokenize boolean expression
        tokens = re.findall(r'\(|\)|\bAND\b|\bOR\b|\bNOT\b|"[^"]+"|[^\s()]+', query_str)
        
        # Replace literal text terms with actual set matching functions
        # For simplicity, we convert tokens into a python-evaluable expression of sets
        all_docs = set(self.documents.keys())
        
        # Build set for each term
        eval_tokens = []
        for tok in tokens:
            tok_upper = tok.upper()
            if tok_upper in ['AND', 'OR', 'NOT', '(', ')']:
                eval_tokens.append(tok_upper.lower().replace('not', '-').replace('and', '&').replace('or', '|'))
            else:
                # Clean term
                term = tok.strip('"').lower()
                # Find matching doc ids
                matching_set = set(self.inverted_index[term].keys()) if term in self.inverted_index else set()
                # Store in a variable-like syntax
                var_name = f"set_{abs(hash(term))}"
                # Bind local variable
                locals()[var_name] = matching_set
                eval_tokens.append(var_name)
                
        # Join expression
        eval_expr = " ".join(eval_tokens)
        # Clean operations to be valid sets syntax
        # NOT in sets: instead of "- set_X" it should be "all_docs - set_X"
        eval_expr = re.sub(r'-\s*(set_\d+)', r'(all_docs - \1)', eval_expr)
        
        try:
            if not eval_expr.strip():
                return []
            matched_set = eval(eval_expr)
            return list(matched_set)
        except Exception as e:
            print(f"[Boolean Search Error] Failed evaluating: {eval_expr}. Error: {e}")
            # Fallback: exact search
            fallback_term = re.sub(r'AND|OR|NOT|\(|\)', '', query_str).strip().lower()
            return list(self.inverted_index[fallback_term].keys()) if fallback_term in self.inverted_index else []

    def _search_tfidf(self, query_str):
        """
        TF-IDF vector space search for natural language queries.
        Computes cosine similarity between document vectors and the query vector.
        """
        query_terms = self._tokenize(query_str)
        if not query_terms:
            return []
            
        N = len(self.documents)
        if N == 0:
            return []
            
        # Calculate Query Term Frequencies (QTF)
        q_tf = defaultdict(int)
        for term in query_terms:
            q_tf[term] += 1
            
        # Query Vector TF-IDF
        q_vector = {}
        q_length = 0.0
        for term, tf in q_tf.items():
            df = self.doc_frequencies[term]
            if df == 0:
                continue
            idf = math.log(1.0 + (N / df))
            tfidf = tf * idf
            q_vector[term] = tfidf
            q_length += tfidf * tfidf
            
        q_length = math.sqrt(q_length)
        if q_length == 0.0:
            # Fallback simple string containment matches
            matched_ids = []
            for doc_id, doc in self.documents.items():
                if any(t in doc["raw_text"].lower() for t in query_terms):
                    matched_ids.append(doc_id)
            return [(d, 0.05) for d in matched_ids]
            
        # Compute cosine similarity for documents containing query terms
        doc_scores = defaultdict(float)
        doc_lengths = defaultdict(float) # for vector normalization
        
        # Accumulate TF-IDF scores for matching documents
        for term, q_tfidf in q_vector.items():
            postings = self.inverted_index[term]
            df = self.doc_frequencies[term]
            idf = math.log(1.0 + (N / df))
            
            for doc_id, tf in postings.items():
                doc_tfidf = tf * idf
                doc_scores[doc_id] += q_tfidf * doc_tfidf
                
        # Calculate document vector lengths
        # In a real Elasticsearch, this is precalculated. Here we compute it on-the-fly.
        for doc_id in doc_scores.keys():
            raw_text = self.documents[doc_id]["raw_text"]
            terms = self._tokenize(raw_text)
            t_counts = defaultdict(int)
            for t in terms:
                t_counts[t] += 1
                
            length_sq = 0.0
            for t, tf in t_counts.items():
                df = self.doc_frequencies[t]
                if df > 0:
                    idf = math.log(1.0 + (N / df))
                    val = tf * idf
                    length_sq += val * val
            doc_lengths[doc_id] = math.sqrt(length_sq)
            
        # Normalize scores to compute true Cosine Similarity
        results = []
        for doc_id, score in doc_scores.items():
            d_len = doc_lengths[doc_id]
            if d_len > 0:
                cos_sim = score / (q_length * d_len)
                results.append((doc_id, cos_sim))
            else:
                results.append((doc_id, 0.05))
                
        return sorted(results, key=lambda x: x[1], reverse=True)

    def _generate_highlight(self, text, query_str, query_type):
        """Generates a text snippet with HTML mark tags around matches."""
        # Extract terms to highlight
        if query_type == 'regex':
            highlight_terms = [query_str]
        elif query_type == 'boolean':
            # Remove operators and brackets
            clean = re.sub(r'AND|OR|NOT|\(|\)', ' ', query_str)
            highlight_terms = self._tokenize(clean)
        else:
            highlight_terms = self._tokenize(query_str)
            
        if not highlight_terms:
            return text[:150] + "..."
            
        # Create regex pattern for all terms
        patterns = []
        for term in highlight_terms:
            if query_type == 'regex':
                patterns.append(term)
            else:
                patterns.append(rf'\b{re.escape(term)}\b')
                
        big_pattern = "|".join(patterns)
        try:
            pattern = re.compile(f"({big_pattern})", re.IGNORECASE)
        except Exception:
            return text[:150] + "..."
            
        # Find first match position
        match = pattern.search(text)
        if not match:
            return text[:150] + "..."
            
        start = max(0, match.start() - 60)
        end = min(len(text), match.end() + 90)
        
        snippet = text[start:end]
        
        # Replace occurrences with html formatting tags
        highlighted = pattern.sub(r"<mark class='glowing-highlight'>\1</mark>", snippet)
        
        prefix = "..." if start > 0 else ""
        suffix = "..." if end < len(text) else ""
        
        return prefix + highlighted + suffix
