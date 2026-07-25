from flask_frozen import Freezer
from main import app
import os
import shutil

# Configure Flask to work with Flask-Frozen
app.config['FREEZER_DESTINATION'] = 'build'
app.config['FREEZER_RELATIVE_URLS'] = False
app.config['FREEZER_BASE_URL'] = 'https://Atharvchaudhari1106.github.io/portfolio/'

freezer = Freezer(app)

if __name__ == '__main__':
    # Clean and create build directory
    if os.path.exists('build'):
        shutil.rmtree('build')
    os.makedirs('build', exist_ok=True)
    
    # Freeze the Flask app
    freezer.freeze()

    # Helper to copy dist directories into static build outputs
    def copy_dist(src_path, project_name):
        if os.path.exists(src_path):
            for target_rel in [project_name, os.path.join('portfolio', project_name)]:
                dest = os.path.join('build', target_rel)
                os.makedirs(dest, exist_ok=True)
                for item in os.listdir(src_path):
                    s = os.path.join(src_path, item)
                    d = os.path.join(dest, item)
                    if os.path.isdir(s):
                        if os.path.exists(d): shutil.rmtree(d)
                        shutil.copytree(s, d)
                    else:
                        shutil.copy2(s, d)
            print(f"Copied {project_name} static dist into build/")

    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    copy_dist(os.path.join(base_dir, 'my works', 'fintrace', 'frontend', 'dist'), 'fintrace')
    copy_dist(os.path.join(base_dir, 'my works', 'bigdata-search', 'frontend', 'dist'), 'bigdata')
    copy_dist(os.path.join(base_dir, '..', 'crimegpt', 'crimegpt-frontend', 'dist'), 'crimegpt')

    print("Portfolio build complete!")
    print("  Build directory: build/")
    print("  Website frozen to static files")
