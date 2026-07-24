import os
import ast
from pathlib import Path

class CodebaseMapper:
    def __init__(self, root_dir):
        self.root_dir = Path(root_dir)
        self.routes = {}
        self.services = {}
        self.models = {}
        self.database = {}

    def scan(self):
        backend_dir = self.root_dir / 'backend' / 'app'
        if not backend_dir.exists():
            print(f"Error: Backend directory not found at {backend_dir}")
            return

        self._scan_dir(backend_dir / 'routes', self.routes, 'route')
        self._scan_dir(backend_dir / 'services', self.services, 'service')
        self._scan_dir(backend_dir / 'models', self.models, 'model')
        self._scan_dir(backend_dir / 'database', self.database, 'database')

    def _scan_dir(self, dir_path, storage, module_type):
        if not dir_path.exists():
            return

        for path in dir_path.glob('**/*.py'):
            if path.name == '__init__.py' or '__pycache__' in path.parts:
                continue

            rel_path = path.relative_to(self.root_dir)
            module_name = path.stem
            
            try:
                with open(path, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                tree = ast.parse(content, filename=str(path))
                
                info = {
                    'path': str(rel_path).replace('\\', '/'),
                    'docstring': ast.get_docstring(tree) or '',
                    'classes': [],
                    'functions': [],
                    'imports': []
                }

                for node in ast.walk(tree):
                    if isinstance(node, ast.Import):
                        for alias in node.names:
                            info['imports'].append(alias.name)
                    elif isinstance(node, ast.ImportFrom):
                        module = node.module or ''
                        for alias in node.names:
                            info['imports'].append(f"{module}.{alias.name}")
                    elif isinstance(node, ast.ClassDef):
                        class_info = {
                            'name': node.name,
                            'docstring': ast.get_docstring(node) or '',
                            'methods': [],
                            'bases': [self._get_source_segment(content, base) for base in node.bases]
                        }
                        for item in node.body:
                            if isinstance(item, ast.FunctionDef) or isinstance(item, ast.AsyncFunctionDef):
                                class_info['methods'].append({
                                    'name': item.name,
                                    'docstring': ast.get_docstring(item) or '',
                                    'args': [arg.arg for arg in item.args.args],
                                    'is_async': isinstance(item, ast.AsyncFunctionDef)
                                })
                        info['classes'].append(class_info)
                    elif isinstance(node, ast.FunctionDef) or isinstance(node, ast.AsyncFunctionDef):
                        # Only add top-level functions (not inside classes)
                        if not any(isinstance(parent, ast.ClassDef) for parent in self._get_parents(tree, node)):
                            decorators = []
                            for dec in node.decorator_list:
                                decorators.append(self._get_source_segment(content, dec))
                            info['functions'].append({
                                'name': node.name,
                                'docstring': ast.get_docstring(node) or '',
                                'decorators': decorators,
                                'args': [arg.arg for arg in node.args.args],
                                'is_async': isinstance(node, ast.AsyncFunctionDef)
                            })

                storage[module_name] = info
            except Exception as e:
                print(f"Error parsing {path}: {e}")

    def _get_parents(self, tree, target):
        parents = []
        for node in ast.walk(tree):
            for child in ast.iter_child_nodes(node):
                if child == target:
                    parents.append(node)
                    parents.extend(self._get_parents(tree, node))
        return parents

    def _get_source_segment(self, content, node):
        try:
            lines = content.splitlines()
            start_line = node.lineno - 1
            end_line = getattr(node, 'end_lineno', node.lineno) - 1
            start_col = node.col_offset
            end_col = getattr(node, 'end_col_offset', len(lines[end_line]))
            
            if start_line == end_line:
                return lines[start_line][start_col:end_col]
            else:
                segment = [lines[start_line][start_col:]]
                for i in range(start_line + 1, end_line):
                    segment.append(lines[i])
                segment.append(lines[end_line][:end_col])
                return '\n'.join(segment)
        except Exception:
            return ''

    def generate_markdown(self):
        output = []
        output.append("# FinTrace Architecture & Codebase Graph Review\n")
        output.append("> [!NOTE]")
        output.append("> This document is automatically generated by `codebase_mapper.py`. It provides a detailed call-graph and component dependency review of the FinTrace project to accelerate future development and code analysis.\n")
        
        # 1. System Dependency Diagram
        output.append("## System Architecture Map\n")
        output.append("```mermaid")
        output.append("graph TD")
        output.append("    subgraph Frontend [React TypeScript Client]")
        output.append("        UI[React Components & Pages] --> API_Client[Axios Client: lib/api.ts]")
        output.append("    end\n")
        output.append("    subgraph Backend [FastAPI Application]")
        output.append("        API_Client --> Routes[FastAPI Routes: app/routes/]")
        output.append("        Routes --> Security[Security Auth: app/core/security.py]")
        output.append("        Routes --> Services[Business Services: app/services/]")
        output.append("        Services --> DB_Drivers[Database Connectors: app/database/]")
        output.append("        Services --> Models[SQLAlchemy Models: app/models/]")
        output.append("    end\n")
        output.append("    subgraph Databases [Storage Tier]")
        output.append("        DB_Drivers --> SQLite_DB[(SQLite: fintrace.db)]")
        output.append("        DB_Drivers --> Neo4j_DB[(Neo4j Bolt: localhost:7687)]")
        output.append("    end\n")
        output.append("    subgraph External [AI Models & Services]")
        output.append("        Services --> Ollama[Local Ollama API: localhost:11434]")
        output.append("    end")
        output.append("```\n")

        # 2. Database & Core Config
        output.append("## 1. Database Connectors & Configurations\n")
        for db_name, info in sorted(self.database.items()):
            output.append(f"### `{db_name}` ([{info['path']}](file:///{self.root_dir.as_posix()}/{info['path']}))")
            if info['docstring']:
                output.append(f"\n{info['docstring']}\n")
            if info['classes']:
                for cls in info['classes']:
                    output.append(f"- **Class**: `{cls['name']}`")
                    for m in cls['methods']:
                        async_str = "async " if m['is_async'] else ""
                        output.append(f"  - `{async_str}def {m['name']}({', '.join(m['args'])})`")
            if info['functions']:
                for fn in info['functions']:
                    async_str = "async " if fn['is_async'] else ""
                    output.append(f"- **Function**: `{async_str}def {fn['name']}({', '.join(fn['args'])})`")
            output.append("")

        # 3. Models
        output.append("## 2. SQLAlchemy ORM Models\n")
        for model_name, info in sorted(self.models.items()):
            output.append(f"### Model: `{model_name}` ([{info['path']}](file:///{self.root_dir.as_posix()}/{info['path']}))")
            if info['docstring']:
                output.append(f"\n{info['docstring']}\n")
            if info['classes']:
                for cls in info['classes']:
                    output.append(f"- **ORM Class**: `{cls['name']}` (inherits from `{', '.join(cls['bases'])}`)")
                    if cls['docstring']:
                        output.append(f"  *Description: {cls['docstring']}*")
            output.append("")

        # 4. Services
        output.append("## 3. Business Logic Services\n")
        for svc_name, info in sorted(self.services.items()):
            output.append(f"### Service: `{svc_name}` ([{info['path']}](file:///{self.root_dir.as_posix()}/{info['path']}))")
            if info['docstring']:
                output.append(f"\n{info['docstring']}\n")
            if info['classes']:
                for cls in info['classes']:
                    output.append(f"- **Class**: `{cls['name']}`")
                    if cls['docstring']:
                        output.append(f"  *Description: {cls['docstring']}*")
                    for m in cls['methods']:
                        async_str = "async " if m['is_async'] else ""
                        output.append(f"  - `{async_str}def {m['name']}({', '.join(m['args'])})`")
                        if m['docstring']:
                            cleaned_doc = m['docstring'].strip().split('\n')[0]
                            output.append(f"    - *{cleaned_doc}*")
            if info['functions']:
                for fn in info['functions']:
                    async_str = "async " if fn['is_async'] else ""
                    output.append(f"- **Function**: `{async_str}def {fn['name']}({', '.join(fn['args'])})`")
            output.append("")

        # 5. API Endpoints
        output.append("## 4. API Endpoint Routers\n")
        for route_name, info in sorted(self.routes.items()):
            output.append(f"### Router: `{route_name}` ([{info['path']}](file:///{self.root_dir.as_posix()}/{info['path']}))")
            if info['docstring']:
                output.append(f"\n{info['docstring']}\n")
            if info['functions']:
                for fn in info['functions']:
                    route_path = "Unknown"
                    for dec in fn['decorators']:
                        if '.get(' in dec or '.post(' in dec or '.put(' in dec or '.delete(' in dec:
                            route_path = dec
                    async_str = "async " if fn['is_async'] else ""
                    output.append(f"- **Endpoint**: `{route_path}`")
                    output.append(f"  - Handler: `{async_str}def {fn['name']}({', '.join(fn['args'])})`")
                    if fn['docstring']:
                        cleaned_doc = fn['docstring'].strip().split('\n')[0]
                        output.append(f"  - *{cleaned_doc}*")
            output.append("")

        return '\n'.join(output)

if __name__ == '__main__':
    root = Path(__file__).resolve().parent
    mapper = CodebaseMapper(root)
    mapper.scan()
    markdown = mapper.generate_markdown()
    
    with open(root / 'codebase_review_graph.md', 'w', encoding='utf-8') as f:
        f.write(markdown)
    print("Successfully generated codebase_review_graph.md!")
