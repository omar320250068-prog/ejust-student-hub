path = r"src\app\layout.tsx"
with open(path) as f:
    s = f.read()
s = s.replace('import "./globals.css";', 'import "./globals.css";\nimport { Providers } from "./providers";')
s = s.replace('<body className={inter.className}>', '<body className={inter.className}>\n        <Providers>')
s = s.replace('</body>', '        </Providers>\n      </body>')
with open(path, 'w') as f:
    f.write(s)
print('ok')
