"""Convierte las filas del Excel de los dueños en reservas para la planilla.

Dos cosas hacen esto menos obvio de lo que parece:

1. Una estadía que cruza de mes está partida en dos filas, para poder imputar
   la facturación a cada mes. Hay que unirlas.

2. La columna `dias` a veces cuenta el día de salida y queda uno de más. Las
   fechas, en cambio, encadenan perfecto: el check-out de una estadía es el
   check-in de la siguiente. Así que mandan las fechas, y `dias` sólo sirve de
   control cruzado.
"""

import datetime
import json
import re
import unicodedata

MESES = {
    'diciem': 12, 'enero': 1, 'febrero': 2, 'marzo': 3, 'abril': 4,
    'mayo': 5, 'junio': 6, 'julio': 7, 'agosto': 8, 'sept': 9,
    'octubre': 10, 'noviem': 11,
}


def sin_tildes(s):
    return ''.join(c for c in unicodedata.normalize('NFD', s)
                   if unicodedata.category(c) != 'Mn')


def mes_de(crudo):
    if not crudo:
        return None
    s = sin_tildes(str(crudo).strip().lower()).rstrip('.')
    for clave, num_mes in MESES.items():
        if s.startswith(sin_tildes(clave)):
            return num_mes
    return None


def es_reserva(f):
    crudo = (f.get('mes') or '').strip()
    if not crudo or crudo.isupper():      # DICIEM, ENERO... = comparativa
        return False
    if mes_de(crudo) is None:             # Total, Fact, Objetivo, Promedio
        return False
    # Una fila con plata es una estadía aunque le falte la fecha. Antes se
    # exigía `fecha` y las que no la tenían desaparecían sin decir nada: así se
    # perdieron cuatro estadías por $1.470.000 en la primera carga. Ahora
    # entran, y si no se pueden ubicar salen listadas al final.
    return bool(f.get('fecha') or num(f.get('importe')))


def fecha_de_la_fila(f):
    """Devuelve (texto de la fecha, si venía corrida de columna).

    La fecha vive en `fecha`, pero en alguna fila se tipeó una columna más a la
    derecha, encima del anticipo. Se reconoce porque tiene forma de rango de
    días ("8 al 15") y no de importe.
    """
    if f.get('fecha'):
        return str(f['fecha']), False

    corrida = str(f.get('anticipo') or '')
    if re.search(r'\d\s*al\s*\d', corrida, re.I):
        return corrida, True

    return '', False


def num(v):
    if v is None or str(v).strip() == '':
        return None
    try:
        return float(str(v).replace(',', '').strip())
    except ValueError:
        return None


def rango(fecha):
    """'5 al 8' -> (5, 8). '31' -> (31, None). 'a al 10' -> (1, 10)."""
    s = str(fecha or '').strip()

    m = re.match(r'^(\d{1,2})\s*al\s*(\d{1,2})$', s, re.I)
    if m:
        return int(m.group(1)), int(m.group(2))

    # "a al 10": la primera parte quedó mal tipeada; en el Excel esas filas son
    # siempre continuaciones, que arrancan el 1.
    m = re.match(r'^\D{1,3}\s*al\s*(\d{1,2})$', s, re.I)
    if m:
        return 1, int(m.group(1))

    m = re.match(r'^(\d{1,2})$', s)
    if m:
        return int(m.group(1)), None

    return None, None


def anio_de(mes, anio_inicio):
    """La temporada arranca en diciembre: ese mes es del año de inicio."""
    return anio_inicio if mes == 12 else anio_inicio + 1


def fecha_de(anio_inicio, mes, dia):
    try:
        return datetime.date(anio_de(mes, anio_inicio), mes, dia)
    except ValueError:
        return None


def convertir(filas, casa, anio_inicio, avisos, sin_ubicar=None):
    res = [f for f in filas if es_reserva(f)]
    salida = []
    i = 0

    def afuera(f, motivo):
        plata = num(f.get('importe')) or 0
        quien = (f.get('inquilinos') or '').strip()
        avisos.append(f"{casa} r{f['_fila']}: {motivo} — queda afuera")
        if sin_ubicar is not None:
            sin_ubicar.append({
                'casa': casa, 'fila': f['_fila'], 'mes': f.get('mes'),
                'dias': f.get('dias'), 'importe': plata,
                'inquilino': quien, 'motivo': motivo,
            })

    while i < len(res):
        f = res[i]
        mes = mes_de(f['mes'])
        texto_fecha, corrida = fecha_de_la_fila(f)
        ini, fin = rango(texto_fecha)

        if ini is None:
            afuera(f, f'sin fecha legible ({f.get("fecha")!r})')
            i += 1
            continue

        check_in = fecha_de(anio_inicio, mes, ini)
        if not check_in:
            afuera(f, f'el día {ini} no existe en ese mes')
            i += 1
            continue

        # Agrupar las filas de continuación: arrancan el 1 del mes siguiente y
        # no tienen nombre propio porque son la segunda mitad de la anterior.
        grupo = [f]
        while i + 1 < len(res):
            sig = res[i + 1]
            sig_mes = mes_de(sig['mes'])
            sig_texto, _ = fecha_de_la_fila(sig)
            sig_ini, _ = rango(sig_texto)
            mes_previo = mes_de(grupo[-1]['mes'])
            esperado = 1 if mes_previo == 12 else mes_previo + 1

            if sig_ini == 1 and not sig.get('inquilinos') and sig_mes == esperado:
                grupo.append(sig)
                i += 1
            else:
                break

        # El check-out sale de la última fila del grupo
        ultima = grupo[-1]
        mes_fin = mes_de(ultima['mes'])
        texto_fin, _ = fecha_de_la_fila(ultima)
        ini_fin, dia_fin = rango(texto_fin)

        if dia_fin is not None:
            mes_salida = mes_fin
            # "27 al 1": el 1 ya es del mes siguiente
            if ini_fin is not None and dia_fin <= ini_fin:
                mes_salida = 1 if mes_fin == 12 else mes_fin + 1
            check_out = fecha_de(anio_inicio, mes_salida, dia_fin)
            # diciembre → enero cambia de año calendario
            if check_out and mes_fin == 12 and mes_salida == 1:
                check_out = check_out.replace(year=check_in.year + 1)
        else:
            noches = sum(int(num(g.get('dias')) or 0) for g in grupo)
            check_out = check_in + datetime.timedelta(days=noches) if noches else None

        if not check_out or check_out <= check_in:
            avisos.append(f"{casa} r{f['_fila']}: no se pudo deducir el check-out — queda afuera")
            i += 1
            continue

        noches = (check_out - check_in).days
        dias_excel = sum(int(num(g.get('dias')) or 0) for g in grupo)
        if dias_excel and dias_excel != noches:
            avisos.append(
                f"{casa} r{f['_fila']} ({texto_fecha}): las fechas dan {noches} noches "
                f"y la columna días dice {dias_excel} — se usan las fechas"
            )

        def primero(campo):
            for g in grupo:
                if g.get(campo):
                    return str(g[campo]).strip()
            return ''

        importe = sum(num(g.get('importe')) or 0 for g in grupo)
        # Si la fecha venía corrida sobre la columna del anticipo, ahí no hay
        # plata sino texto: sumarlo daría 0, pero dejarlo explícito evita
        # que alguien 'arregle' el num() más adelante y meta basura.
        anticipo = sum(0 if fecha_de_la_fila(g)[1] else (num(g.get('anticipo')) or 0)
                       for g in grupo)

        salida.append({
            'casa': casa,
            'filas': [g['_fila'] for g in grupo],
            'partida': len(grupo) > 1,
            'check_in': check_in.isoformat(),
            'check_out': check_out.isoformat(),
            'noches': noches,
            'importe': int(round(importe)) or None,
            'anticipo': int(round(anticipo)) or None,
            'inquilino': primero('inquilinos'),
            'telefono': primero('telefono'),
            'dni': primero('dni'),
            'facturado': 'si' if primero('fac').lower() == 'si' else ('no' if primero('fac') else ''),
            'cotizacion_usd': int(num(primero('dolar')) or 0) or None,
        })
        i += 1

    return salida


def solapamientos(reservas):
    """Dos estadías de la misma casa no pueden pisarse. El día de salida de una
    puede ser el de entrada de la siguiente, eso no es solape."""
    choques = []
    por_casa = {}
    for r in reservas:
        por_casa.setdefault(r['casa'], []).append(r)

    for casa, lista in por_casa.items():
        lista.sort(key=lambda r: r['check_in'])
        for a, b in zip(lista, lista[1:]):
            if b['check_in'] < a['check_out']:
                choques.append((casa, a, b))
    return choques


def totales_del_excel(datos):
    """Lo que el propio Excel calculaba por casa, para contrastar la carga.

    Es el único control externo que hay: si la suma de lo importado no da lo
    mismo que la fila `Total` de ellos, algo se está perdiendo.
    """
    salida = {}
    for temporada, casas in datos.items():
        for casa, filas in casas.items():
            tot = next((f for f in filas if (f.get('mes') or '').strip() == 'Total'), None)
            if tot:
                salida[(temporada, casa)] = num(tot.get('importe')) or 0
    return salida


def main():
    datos = json.load(open('extraido.json'))
    avisos = []
    sin_ubicar = []
    todo = []

    for temporada, casas in datos.items():
        anio_inicio = 2025 if '25-26' in temporada else 2026
        for casa, filas in casas.items():
            for r in convertir(filas, casa, anio_inicio, avisos, sin_ubicar):
                r['temporada'] = temporada
                todo.append(r)

    json.dump(todo, open('reservas_excel.json', 'w'), ensure_ascii=False, indent=1)

    print(f'estadías: {len(todo)}')
    print(f'  partidas en 2 filas y unidas: {sum(1 for r in todo if r["partida"])}')
    print(f'  sin nombre de inquilino: {sum(1 for r in todo if not r["inquilino"])}')
    print(f'  noches: {sum(r["noches"] for r in todo)}')
    print(f'  importe: $ {sum(r["importe"] or 0 for r in todo):,.0f}')
    print(f'  anticipo: $ {sum(r["anticipo"] or 0 for r in todo):,.0f}')

    choques = solapamientos(todo)
    print(f'\nsolapamientos entre estadías: {len(choques)}')
    for casa, a, b in choques:
        print(f'  ⚠ {casa}: {a["check_in"]}→{a["check_out"]} (r{a["filas"]}) pisa '
              f'{b["check_in"]}→{b["check_out"]} (r{b["filas"]})')

    print(f'\navisos: {len(avisos)}')
    for a in avisos:
        print('  ⚠ ' + a)

    # El control que faltaba en la primera carga: contrastar contra los totales
    # que el propio Excel calculaba.
    print('\ncontra los totales del Excel:')
    esperados = totales_del_excel(datos)
    cargado = {}
    for r in todo:
        k = (r['temporada'], r['casa'])
        cargado[k] = cargado.get(k, 0) + (r['importe'] or 0)

    falta_total = 0
    for k in sorted(esperados):
        d = esperados[k] - cargado.get(k, 0)
        falta_total += d
        estado = 'ok' if abs(d) < 1 else f'FALTAN $ {d:,.0f}'.replace(',', '.')
        print(f'  {k[0]} {k[1]}: {estado}')
    print(f'  --- diferencia total: $ {falta_total:,.0f} ---'.replace(',', '.'))

    if sin_ubicar:
        print(f'\nfilas con plata que no se pudieron ubicar: {len(sin_ubicar)}')
        for s in sin_ubicar:
            quien = s['inquilino'] or 'sin nombre'
            print(f"  ⚠ {s['casa']} r{s['fila']} · {s['mes']} · {s['dias']} días · "
                  f"$ {s['importe']:,.0f} · {quien} · {s['motivo']}".replace(',', '.'))


if __name__ == '__main__':
    main()
