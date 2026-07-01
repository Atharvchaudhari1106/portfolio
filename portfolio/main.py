from flask import Flask, render_template, send_from_directory
import os

app = Flask(__name__)

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/portfolio/music/')
@app.route('/portfolio/music/<path:path>')
def serve_music(path='index.html'):
    dist_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'music-app', 'dist'))
    return send_from_directory(dist_dir, path)

if __name__ == '__main__':
    app.run(debug=True, host='127.0.0.1', port=5002)

