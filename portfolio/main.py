from flask import Flask, render_template, send_from_directory
import os

app = Flask(__name__)

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/portfolio/bigdata/')
@app.route('/portfolio/bigdata/<path:path>')
def serve_bigdata(path='index.html'):
    possible_paths = [
        os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'my works', 'bigdata-search', 'frontend', 'dist')),
        os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'portfolio', 'my works', 'bigdata-search', 'frontend', 'dist'))
    ]
    dist_dir = next((p for p in possible_paths if os.path.exists(p)), possible_paths[0])
    target_file = os.path.join(dist_dir, path)
    if not os.path.exists(dist_dir) or not os.path.exists(target_file):
        if os.path.exists(os.path.join(dist_dir, 'index.html')):
            return send_from_directory(dist_dir, 'index.html')
        return "Intelligence-X Live Demo placeholder (building...)", 200
    return send_from_directory(dist_dir, path)

@app.route('/portfolio/crimegpt/')
@app.route('/portfolio/crimegpt/<path:path>')
def serve_crimegpt(path='index.html'):
    possible_paths = [
        os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'crimegpt', 'crimegpt-frontend', 'dist')),
        os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'crimegpt', 'crimegpt-frontend', 'dist'))
    ]
    dist_dir = next((p for p in possible_paths if os.path.exists(p)), possible_paths[0])
    target_file = os.path.join(dist_dir, path)
    if not os.path.exists(dist_dir) or not os.path.exists(target_file):
        if os.path.exists(os.path.join(dist_dir, 'index.html')):
            return send_from_directory(dist_dir, 'index.html')
        return "CrimeGPT Live Demo placeholder (building...)", 200
    return send_from_directory(dist_dir, path)

if __name__ == '__main__':
    app.run(debug=True, host='127.0.0.1', port=5002)

