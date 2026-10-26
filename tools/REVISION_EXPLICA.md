# Revisión: contradicciones vault ↔ literatura (explicaciones de las cartas)

Encontradas al redactar `data/explica.json` (165 cartas). En la app se siguió **el vault** y la diferencia
quedó anotada entre corchetes al final de "Por qué pasa". Marca cada una: ✅ dejar el vault · 🔁 cambiar a literatura.

## Signos vitales, examen general, coagulación (g1)
- [ ] Pulso en fiebre: vault +12-15 lpm/°C · literatura ~10.
- [ ] PA normal: vault <130/85 (o <140/90) · ACC/AHA 2017: HTA desde 130/80.
- [ ] Hipotermia: vault ligera 28-34 / profunda 17-28 / muy profunda <17 · literatura leve 32-35 / moderada 28-32 / grave <28.
- [ ] IMC: docente 19-23 / 24-25 / >26 · OMS 18,5-24,9 / 25-29,9 / ≥30.
- [ ] Deshidratación hipotónica: Na <130 (2020) · <135 (2018 y literatura).
- [ ] VSG normal "descarta infección bacteriana" (INMUNO 18): la literatura no lo acepta.
- [ ] Tiempo de sangría prolongado por déficit de factores (Cap. 37): en literatura depende de plaquetas/vWF (normal en hemofilia).
- [ ] Dentro del vault: SatO₂ altura 90 % vs 88-92 % (atlas dice 85-92 %) · fibrinógeno 200-400 vs 100-700 · llenado capilar 2 s vs 3 s.

## Hemograma, glucosa, riñón, electrolitos (g2)
- [ ] Hb en Puno "común 24-26 g/dL": residente sano ~16-18; ≥21 (♂) / ≥19 (♀) ya es criterio de Monge.
- [ ] Magnesio 1,8-2,3 **mEq/L**: ese rango es en mg/dL (≈1,4-2,0 mEq/L).
- [ ] Calcio 6-11 mg/dL (2020): literatura 8,5-10,5.
- [ ] Sangrado espontáneo con plaquetas <30 000 (Cap. 37) · literatura <10-20 000.
- [ ] Linfocitos/monocitos en "/mL": la unidad es /µL.
- [ ] Hematocrito 40-45 % sin sexo · literatura ♂ 41-50, ♀ 36-44.
- [ ] Creatinina 0,6-1,4 sin sexo · ♂ 0,7-1,2, ♀ 0,5-1,1.

## Hígado, páncreas, lípidos, orina, heces (g3)
- [ ] Bilirrubina total normal 1,5 (Esquema 36) vs 1,2 (resto del vault).
- [ ] Urobilinógeno en ictericia obstructiva: 10b "aumenta" vs 09a/literatura "ausente" (se siguió 09a).
- [ ] Amilasa normaliza en 36-72 h (09d) · literatura 3-5 días.
- [ ] Lipasa sube a las 72-96 h (PATOLOGÍA) · literatura sube a las 4-8 h y dura 8-14 días.
- [ ] Patrón obstructivo con transaminasas normales: pueden subir transitoriamente al enclavarse un cálculo.
- [ ] Densidad urinaria en "mg/ml": no tiene unidad.
- [ ] Piuria: >10/campo (SEMIOLOGÍA) vs >5-10 (FISIOPATO) · literatura >5.
- [ ] Diarrea aguda: <1 mes (09a) vs <2-3 semanas (09e) · literatura <14 días.
- [ ] Hipoalbuminemia: <3,5 / <3 / <2 según la nota.

## Ecografía, ECG, Rx de tórax (g4)
- [ ] FA: frecuencia auricular 400-600 (08l) vs 350-450.
- [ ] Déficit de pulso: el ejemplo de 08l está invertido (la radial es la menor).
- [ ] Bradicardia sinusal "con PR y QRS alargados" (08l): en literatura son normales.
- [ ] BRI con QRS <0,12 s (08k): errata, el bloqueo completo es ≥0,12 s.
- [ ] Onda T 5-10 mm vs <5 mm extremidades / <10 mm precordiales.
- [ ] Dentro del vault: bazo palpable al duplicar vs 2-3 veces · QT 0,25-0,40 (2018).

## Gases, líquidos pleural/ascítico/LCR (g5)
- [ ] Acidosis respiratoria con pH <7,32 (docente) · literatura <7,35.
- [ ] HCO₃⁻ <24 = acidosis metabólica (docente) · literatura <22.
- [ ] PaO₂/PaCO₂ anotadas en "mEq" (Clase 08): son mmHg.
- [ ] Exceso de base ±2,5 vs ±2.
- [ ] Volumen pleural normal 3-5 ml vs 5-15 ml.
- [ ] Células LCR "<5 por ml": es por mm³ (µL).
- [ ] Glucosa LCR 50-60 % de la glucemia · literatura ~60-66 %.
- [ ] Presión LCR <180 mmH₂O vs "hasta 20 cmH₂O" (≈200) · Guyton ~130.
- [ ] Dentro del vault: toracocentesis 8.º-9.º EIC vs 7.º-8.º · "LCR purulento" en Empiema-Pleural (debe decir líquido pleural).

## Escalas (g6)
- [ ] Wells TEP: cortes ≤4 / 5-6 / ≥7 (Score-de-Wells.md) vs <2 / 2-6 / >6 (TVE y literatura).
- [ ] Hemoptisis masiva >600 ml/24 h · muchos textos desde 200 ml; tramo 200-600 sin clasificar.
- [ ] Proteinuria en cruces: + = 1 g/L… · tiras habituales + ≈ 0,3, ++ ≈ 1, +++ ≈ 3 g/L.
- [ ] Función renal por TFG (docente) vs KDIGO G1-G5 (ERC <60).
- [ ] Matidez desplazable desde 500 ml de ascitis: varios textos piden más volumen.

Para aplicar un cambio: editar `data/explica_parts/gN.json` (y, si es un valor del atlas, el vault) y correr
`py tools/unir_explica.py` y `py tools/precache.py`.
