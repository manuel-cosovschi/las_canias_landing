"""Manda las filas al importador de n8n en tandas chicas.

En tandas porque si algo se corta a mitad de camino conviene saber exactamente
qué quedó escrito: cada tanda se confirma antes de mandar la siguiente.
"""

import json
import os
import subprocess
import time

URL = 'https://cosovschim.app.n8n.cloud/webhook/importar-excel'
TANDA = 30

# El mismo secreto que usan las funciones de Netlify. No va en el repo:
#   LC_OWNER_SECRET=... python3 enviar.py
SECRETO = os.environ.get('LC_OWNER_SECRET', '')


def postear(filas):
    payload = json.dumps({'rows': filas}, ensure_ascii=False)
    for intento in range(1, 5):
        p = subprocess.run(
            ['curl', '-sS', '--max-time', '180', '-X', 'POST', URL,
             '-H', 'content-type: application/json',
             '-H', f'x-lc-secret: {SECRETO}',
             '--data-binary', '@-',
             '-w', '\n%{http_code}'],
            input=payload, capture_output=True, text=True,
        )
        partes = p.stdout.rsplit('\n', 1)
        cuerpo = partes[0] if len(partes) == 2 else p.stdout
        codigo = partes[1].strip() if len(partes) == 2 else '000'
        if codigo == '200':
            return json.loads(cuerpo)
        print(f'    intento {intento}: http {codigo} {cuerpo[:200]}')
        time.sleep(intento * 3)
    raise SystemExit('la tanda no entró')


def main():
    if not SECRETO:
        raise SystemExit('falta LC_OWNER_SECRET en el entorno')

    filas = json.load(open('filas_planilla.json'))

    print(f'a escribir: {len(filas)} filas en tandas de {TANDA}')
    escritas = 0

    for i in range(0, len(filas), TANDA):
        tanda = filas[i:i + TANDA]
        print(f'\ntanda {i // TANDA + 1}: {len(tanda)} filas '
              f'({tanda[0]["check_in"]} … {tanda[-1]["check_in"]})')
        r = postear(tanda)
        print(f'    -> {r}')
        if not r.get('ok'):
            raise SystemExit(f'la tanda escribió {r.get("escritas")} de {r.get("pedidas")}; freno acá')
        escritas += r['escritas']
        time.sleep(4)

    print(f'\nlisto: {escritas} filas escritas')


if __name__ == '__main__':
    main()
