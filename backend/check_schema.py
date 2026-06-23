import sqlite3
conn = sqlite3.connect('egov_prod.db')
print(conn.execute("SELECT sql FROM sqlite_master WHERE name='tickets'").fetchone()[0])
