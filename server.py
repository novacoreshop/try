#!/usr/bin/env python3
import json
import os
import secrets
import sqlite3
from contextlib import closing
from datetime import UTC, datetime
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / 'data'
DB_PATH = DATA_DIR / 'novacore.db'
HOST = os.getenv('HOST', '127.0.0.1')
PORT = int(os.getenv('PORT', '8000'))
ADMIN_PASSWORD = os.getenv('NOVACORE_ADMIN_PASSWORD', 'novacore2025')
ADMIN_TOKENS = set()

PRODUCT_SEED = [
    {'id': 1, 'name': 'Core Oversized Hoodie', 'cat': 'hoodies', 'price': 185, 'sale': None, 'badge': 'new', 'desc': '400GSM French Terry. Garment-washed. Dropped shoulder silhouette.', 'stock': 24, 'colors': ['#1a1a1a', '#3a3836', '#c8bfb0']},
    {'id': 2, 'name': 'Phantom Graphic Tee', 'cat': 'tees', 'price': 95, 'sale': None, 'badge': 'new', 'desc': '240GSM heavyweight cotton. Screen-printed Nova Core graphic.', 'stock': 38, 'colors': ['#1a1a1a', '#f0ede8']},
    {'id': 3, 'name': 'Core Capsule Hoodie', 'cat': 'hoodies', 'price': 220, 'sale': 165, 'badge': 'ltd', 'desc': 'Limited colourway. Same construction as Core Hoodie — fewer made.', 'stock': 5, 'colors': ['#2c2420', '#c8bfb0']},
    {'id': 4, 'name': 'Structured 6-Panel Cap', 'cat': 'hats', 'price': 75, 'sale': None, 'badge': '', 'desc': 'Structured crown, adjustable clasp. Embroidered NC logo.', 'stock': 19, 'colors': ['#1a1a1a', '#3a3836', '#c8bfb0']},
    {'id': 5, 'name': 'Volume Shorts', 'cat': 'shorts', 'price': 115, 'sale': None, 'badge': 'new', 'desc': 'Relaxed wide-leg short. 340GSM fleece-back. Side pockets.', 'stock': 22, 'colors': ['#1a1a1a', '#3a3836']},
    {'id': 6, 'name': 'Essential Heavyweight Tee', 'cat': 'tees', 'price': 85, 'sale': None, 'badge': '', 'desc': 'Classic fit. 280GSM ring-spun cotton. The everyday piece.', 'stock': 0, 'colors': ['#1a1a1a', '#3a3836', '#f0ede8', '#2c2420']},
    {'id': 7, 'name': 'NC Quarter Zip', 'cat': 'hoodies', 'price': 155, 'sale': None, 'badge': '', 'desc': 'Half-zip pullover. Brushed interior. Minimal Nova Core chest logo.', 'stock': 14, 'colors': ['#1a1a1a', '#c8bfb0']},
    {'id': 8, 'name': 'Dad Hat — Washed Black', 'cat': 'hats', 'price': 65, 'sale': None, 'badge': '', 'desc': 'Unstructured low-profile cap. Pre-curved brim. Tonal embroidery.', 'stock': 31, 'colors': ['#1a1a1a']},
    {'id': 9, 'name': 'Arc Graphic Tee', 'cat': 'tees', 'price': 90, 'sale': 75, 'badge': 'ltd', 'desc': 'Limited run Arc Series. Oversized print, heavyweight cotton.', 'stock': 8, 'colors': ['#1a1a1a', '#f0ede8']},
]

ORDER_SEED = [
    {
        'order_number': 'NC-123456',
        'email': 'your@email.com',
        'item': '1× Core Oversized Hoodie (M, Phantom Black)',
        'dates': ['Mar 28, 2026', 'Mar 29, 2026', 'Mar 30, 2026 — Estimated delivery Apr 2'],
        'final_text': 'Estimated: Apr 2, 2026',
        'state': ['done', 'done', 'current', 'pending'],
    },
    {
        'order_number': 'NC-009284',
        'email': 'jordan@example.com',
        'item': '2× Phantom Graphic Tee',
        'dates': ['Mar 21, 2026', 'Mar 22, 2026', 'Mar 23, 2026'],
        'final_text': 'Delivered Mar 25, 2026',
        'state': ['done', 'done', 'done', 'done'],
    },
]

SPA_PATHS = {
    '/',
    '/shop',
    '/about',
    '/contact',
    '/tracking',
    '/custom',
    '/shipping',
    '/size-guide',
    '/privacy',
    '/terms',
    '/cookies',
    '/admin-login',
    '/admin',
    '/product',
}


def get_db():
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def now_iso():
    return datetime.now(UTC).replace(microsecond=0).isoformat().replace('+00:00', 'Z')


def init_db():
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    with closing(get_db()) as conn:
        cursor = conn.cursor()
        cursor.executescript(
            '''
            CREATE TABLE IF NOT EXISTS products (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                cat TEXT NOT NULL,
                price INTEGER NOT NULL,
                sale INTEGER,
                badge TEXT DEFAULT '',
                desc TEXT NOT NULL,
                stock INTEGER NOT NULL DEFAULT 0,
                colors TEXT NOT NULL DEFAULT '[]',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS newsletter_subscribers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT NOT NULL UNIQUE,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS contact_requests (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                first_name TEXT NOT NULL,
                last_name TEXT DEFAULT '',
                email TEXT NOT NULL,
                order_number TEXT DEFAULT '',
                subject TEXT NOT NULL,
                message TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS custom_requests (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT NOT NULL,
                request_type TEXT NOT NULL,
                base_garment TEXT DEFAULT '',
                brief TEXT NOT NULL,
                budget TEXT NOT NULL,
                timeline TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS orders (
                order_number TEXT PRIMARY KEY,
                email TEXT NOT NULL,
                item TEXT NOT NULL,
                dates_json TEXT NOT NULL,
                final_text TEXT NOT NULL,
                state_json TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
            '''
        )

        product_count = cursor.execute('SELECT COUNT(*) FROM products').fetchone()[0]
        if product_count == 0:
            cursor.executemany(
                '''
                INSERT INTO products (name, cat, price, sale, badge, desc, stock, colors, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''',
                [
                    (
                        item['name'],
                        item['cat'],
                        item['price'],
                        item['sale'],
                        item['badge'],
                        item['desc'],
                        item['stock'],
                        json.dumps(item['colors']),
                        now_iso(),
                        now_iso(),
                    )
                    for item in PRODUCT_SEED
                ],
            )

        order_count = cursor.execute('SELECT COUNT(*) FROM orders').fetchone()[0]
        if order_count == 0:
            cursor.executemany(
                '''
                INSERT INTO orders (order_number, email, item, dates_json, final_text, state_json, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ''',
                [
                    (
                        order['order_number'],
                        order['email'],
                        order['item'],
                        json.dumps(order['dates']),
                        order['final_text'],
                        json.dumps(order['state']),
                        now_iso(),
                    )
                    for order in ORDER_SEED
                ],
            )

        conn.commit()


def row_to_product(row):
    return {
        'id': row['id'],
        'name': row['name'],
        'cat': row['cat'],
        'price': row['price'],
        'sale': row['sale'],
        'badge': row['badge'] or '',
        'desc': row['desc'],
        'stock': row['stock'],
        'colors': json.loads(row['colors'] or '[]'),
    }


def parse_product_payload(payload):
    name = str(payload.get('name', '')).strip()
    cat = str(payload.get('cat', 'tees')).strip() or 'tees'
    desc = str(payload.get('desc', '')).strip() or 'Premium Nova Core piece.'
    badge = str(payload.get('badge', '')).strip()
    colors = payload.get('colors') or ['#1a1a1a']

    if isinstance(colors, str):
        colors = [part.strip() for part in colors.split(',') if part.strip()]

    if not isinstance(colors, list) or not colors:
        colors = ['#1a1a1a']

    try:
        price = int(payload.get('price', 0))
        sale_raw = payload.get('sale')
        sale = int(sale_raw) if sale_raw not in (None, '', 'null') else None
        stock = max(0, int(payload.get('stock', 0)))
    except (TypeError, ValueError):
        raise ValueError('Price, sale, and stock must be valid numbers.')

    if not name or price <= 0:
        raise ValueError('A valid product name and price are required.')

    if sale is not None and sale <= 0:
        sale = None

    return {
        'name': name,
        'cat': cat,
        'price': price,
        'sale': sale,
        'badge': badge,
        'desc': desc,
        'stock': stock,
        'colors': colors,
    }


class NovaCoreHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Token')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def log_message(self, fmt, *args):
        print(f'[server] {self.address_string()} - {fmt % args}')

    def send_json(self, payload, status=200):
        body = json.dumps(payload).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def read_json(self):
        length = int(self.headers.get('Content-Length', '0') or 0)
        raw = self.rfile.read(length) if length else b'{}'
        try:
            return json.loads(raw.decode('utf-8') or '{}')
        except json.JSONDecodeError:
            self.send_json({'error': 'Invalid JSON body.'}, 400)
            return None

    def require_admin(self):
        token = self.headers.get('X-Admin-Token', '').strip()
        if token and token in ADMIN_TOKENS:
            return True
        self.send_json({'error': 'Admin sign-in required.'}, 401)
        return False

    def list_products(self):
        with closing(get_db()) as conn:
            rows = conn.execute('SELECT * FROM products ORDER BY id').fetchall()
        return [row_to_product(row) for row in rows]

    def do_GET(self):
        parsed = urlparse(self.path)

        if parsed.path == '/api/health':
            return self.send_json({'status': 'ok', 'database': str(DB_PATH)})

        if parsed.path == '/api/products':
            return self.send_json({'products': self.list_products()})

        if parsed.path == '/api/orders/track':
            params = parse_qs(parsed.query)
            order_number = (params.get('orderNumber', [''])[0] or '').strip().upper()
            email = (params.get('email', [''])[0] or '').strip().lower()

            if not order_number or not email:
                return self.send_json({'error': 'Order number and email are required.'}, 400)

            with closing(get_db()) as conn:
                row = conn.execute(
                    'SELECT * FROM orders WHERE order_number = ? AND lower(email) = ?',
                    (order_number, email),
                ).fetchone()

            if not row:
                return self.send_json({'error': 'No order matched those details.'}, 404)

            return self.send_json(
                {
                    'order': {
                        'orderNumber': row['order_number'],
                        'email': row['email'],
                        'item': row['item'],
                        'dates': json.loads(row['dates_json']),
                        'finalText': row['final_text'],
                        'state': json.loads(row['state_json']),
                    }
                }
            )

        if parsed.path in SPA_PATHS:
            self.path = '/index.html'
            return super().do_GET()

        return super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        payload = self.read_json()
        if payload is None:
            return

        if parsed.path == '/api/admin/login':
            password = str(payload.get('password', ''))
            if password != ADMIN_PASSWORD:
                return self.send_json({'error': 'Incorrect password.'}, 401)

            token = secrets.token_urlsafe(24)
            ADMIN_TOKENS.add(token)
            return self.send_json({'message': 'Logged in.', 'token': token})

        if parsed.path == '/api/admin/logout':
            token = self.headers.get('X-Admin-Token', '').strip()
            ADMIN_TOKENS.discard(token)
            return self.send_json({'message': 'Logged out.'})

        if parsed.path == '/api/newsletter':
            email = str(payload.get('email', '')).strip().lower()
            if not email:
                return self.send_json({'error': 'Email is required.'}, 400)

            with closing(get_db()) as conn:
                try:
                    conn.execute(
                        'INSERT INTO newsletter_subscribers (email, created_at) VALUES (?, ?)',
                        (email, now_iso()),
                    )
                    conn.commit()
                except sqlite3.IntegrityError:
                    return self.send_json({'error': 'You are already on the list.'}, 409)

            return self.send_json({'message': "You're in. Welcome to Nova Core."}, 201)

        if parsed.path == '/api/contact':
            first_name = str(payload.get('firstName', '')).strip()
            last_name = str(payload.get('lastName', '')).strip()
            email = str(payload.get('email', '')).strip().lower()
            order_number = str(payload.get('orderNumber', '')).strip().upper()
            subject = str(payload.get('subject', '')).strip()
            message = str(payload.get('message', '')).strip()

            if not first_name or not email or not subject or not message:
                return self.send_json({'error': 'Please complete the required fields.'}, 400)

            with closing(get_db()) as conn:
                conn.execute(
                    '''
                    INSERT INTO contact_requests (first_name, last_name, email, order_number, subject, message, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    ''',
                    (first_name, last_name, email, order_number, subject, message, now_iso()),
                )
                conn.commit()

            return self.send_json({'message': "Message sent. We'll be in touch within 24 hours."}, 201)

        if parsed.path == '/api/custom':
            name = str(payload.get('name', '')).strip()
            email = str(payload.get('email', '')).strip().lower()
            request_type = str(payload.get('requestType', '')).strip()
            base_garment = str(payload.get('baseGarment', '')).strip()
            brief = str(payload.get('brief', '')).strip()
            budget = str(payload.get('budget', '')).strip()
            timeline = str(payload.get('timeline', '')).strip()

            if not name or not email or not brief:
                return self.send_json({'error': 'Please add your name, email, and design brief.'}, 400)

            with closing(get_db()) as conn:
                conn.execute(
                    '''
                    INSERT INTO custom_requests (name, email, request_type, base_garment, brief, budget, timeline, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    ''',
                    (name, email, request_type, base_garment, brief, budget, timeline, now_iso()),
                )
                conn.commit()

            return self.send_json({'message': "Request received. We'll review and contact you within 48 hours."}, 201)

        if parsed.path == '/api/products':
            if not self.require_admin():
                return

            try:
                product = parse_product_payload(payload)
            except ValueError as error:
                return self.send_json({'error': str(error)}, 400)

            with closing(get_db()) as conn:
                cursor = conn.execute(
                    '''
                    INSERT INTO products (name, cat, price, sale, badge, desc, stock, colors, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ''',
                    (
                        product['name'],
                        product['cat'],
                        product['price'],
                        product['sale'],
                        product['badge'],
                        product['desc'],
                        product['stock'],
                        json.dumps(product['colors']),
                        now_iso(),
                        now_iso(),
                    ),
                )
                conn.commit()
                new_row = conn.execute('SELECT * FROM products WHERE id = ?', (cursor.lastrowid,)).fetchone()

            return self.send_json({'message': f"{product['name']} added successfully.", 'product': row_to_product(new_row)}, 201)

        self.send_json({'error': 'Endpoint not found.'}, 404)

    def do_PUT(self):
        parsed = urlparse(self.path)

        if not parsed.path.startswith('/api/products/'):
            return self.send_json({'error': 'Endpoint not found.'}, 404)

        if not self.require_admin():
            return

        payload = self.read_json()
        if payload is None:
            return

        try:
            product_id = int(parsed.path.rsplit('/', 1)[-1])
            product = parse_product_payload(payload)
        except ValueError as error:
            return self.send_json({'error': str(error)}, 400)

        with closing(get_db()) as conn:
            existing = conn.execute('SELECT id FROM products WHERE id = ?', (product_id,)).fetchone()
            if not existing:
                return self.send_json({'error': 'Product not found.'}, 404)

            conn.execute(
                '''
                UPDATE products
                SET name = ?, cat = ?, price = ?, sale = ?, badge = ?, desc = ?, stock = ?, colors = ?, updated_at = ?
                WHERE id = ?
                ''',
                (
                    product['name'],
                    product['cat'],
                    product['price'],
                    product['sale'],
                    product['badge'],
                    product['desc'],
                    product['stock'],
                    json.dumps(product['colors']),
                    now_iso(),
                    product_id,
                ),
            )
            conn.commit()
            updated = conn.execute('SELECT * FROM products WHERE id = ?', (product_id,)).fetchone()

        return self.send_json({'message': f"{product['name']} updated.", 'product': row_to_product(updated)})

    def do_DELETE(self):
        parsed = urlparse(self.path)

        if not parsed.path.startswith('/api/products/'):
            return self.send_json({'error': 'Endpoint not found.'}, 404)

        if not self.require_admin():
            return

        try:
            product_id = int(parsed.path.rsplit('/', 1)[-1])
        except ValueError:
            return self.send_json({'error': 'Invalid product id.'}, 400)

        with closing(get_db()) as conn:
            row = conn.execute('SELECT name FROM products WHERE id = ?', (product_id,)).fetchone()
            if not row:
                return self.send_json({'error': 'Product not found.'}, 404)

            conn.execute('DELETE FROM products WHERE id = ?', (product_id,))
            conn.commit()

        return self.send_json({'message': f"{row['name']} deleted."})


def run():
    init_db()
    server = ThreadingHTTPServer((HOST, PORT), NovaCoreHandler)
    print(f'NOVA CORE server running at http://{HOST}:{PORT}')
    print(f'SQLite database: {DB_PATH}')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\nShutting down server...')
    finally:
        server.server_close()


if __name__ == '__main__':
    run()
