"""Arma las filas de la planilla a partir de las estadías ya convertidas.

Los nombres de los campos son los encabezados reales de la hoja `reservas`;
el nodo de Google Sheets mapea por nombre, así que lo que no coincide se
descarta en vez de inventar una columna nueva.
"""

import datetime
import json

AHORA = datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='seconds')

SIN_NOMBRE = '(sin nombre en el Excel)'


def sufijo(temporada):
    return '2526' if '25-26' in temporada else '2627'


def fila(r):
    filas_origen = ', '.join(str(f) for f in r['filas'])
    nota = (
        f"Importado del Excel de los dueños · {r['temporada']} · "
        f"fila{'s' if len(r['filas']) > 1 else ''} {filas_origen}"
    )

    return {
        'id': f"XL-{sufijo(r['temporada'])}-{r['casa']}-{r['check_in']}",
        'status': 'CONFIRMED',
        'source': 'excel',
        'house_code': r['casa'],
        'check_in': r['check_in'],
        'check_out': r['check_out'],
        'guest_name': r['inquilino'] or SIN_NOMBRE,
        'dni': r['dni'],
        'email': '',
        'phone': r['telefono'],
        'guests': '',
        'payment_method': '',
        'notes': nota,
        'created_at': AHORA,
        'approved_at': AHORA,
        'importe': str(r['importe']) if r['importe'] else '',
        'anticipo': str(r['anticipo']) if r['anticipo'] else '',
        'facturado': r['facturado'],
        'cotizacion_usd': str(r['cotizacion_usd']) if r['cotizacion_usd'] else '',
    }


def main():
    estadias = json.load(open('reservas_excel.json'))
    filas = [fila(r) for r in estadias]

    ids = [f['id'] for f in filas]
    repetidos = sorted({i for i in ids if ids.count(i) > 1})
    if repetidos:
        raise SystemExit(f'ids repetidos: {repetidos}')

    filas.sort(key=lambda f: (f['check_in'], f['house_code']))
    json.dump(filas, open('filas_planilla.json', 'w'), ensure_ascii=False, indent=1)

    print(f'filas listas: {len(filas)}  (ids únicos: {len(set(ids))})')
    print(f'sin nombre: {sum(1 for f in filas if f["guest_name"] == SIN_NOMBRE)}')
    print('\nprimera:')
    print(json.dumps(filas[0], ensure_ascii=False, indent=1))
    print('\núltima:')
    print(json.dumps(filas[-1], ensure_ascii=False, indent=1))


if __name__ == '__main__':
    main()
