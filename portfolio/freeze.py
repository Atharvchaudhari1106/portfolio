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
    print("Portfolio build complete!")
    print("  Build directory: build/")
    print("  Website frozen to static files")
