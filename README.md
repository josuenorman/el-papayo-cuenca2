# Cuenca 2 · El Papayo · Visor 2D/3D

Visor estático independiente de QGIS Server, preparado para GitHub Pages.

## Funciones

- Capas 2D organizadas por grupo, transparencia y leyendas.
- Terreno 3D derivado del DEM, con máscara de datos válidos.
- Hasta tres superposiciones ráster o vectoriales renderizadas, con opacidad independiente y orden inferior/intermedio/superior.
- Exageración vertical 1–5× y restablecimiento de cámara.
- Presentación inicial y botón para volver a consultar datos, método, parámetros y límites del modelo.

## Representación

Las variables continuas seleccionadas se muestran con contraste P2–P98. Los valores extremos usan los colores terminales; no se cambian los archivos fuente ni los resultados. Las clases categóricas SHALSTAB conservan sus estilos.
El terreno se remuestrea a 256 × 256 para visualización. Las texturas UTM se componen sobre el terreno; las imágenes 2D se reproyectan a EPSG:3857. La luz 3D y las opacidades alteran el color percibido: consultar la leyenda y aislar una capa para interpretarla.
Los rásteres publicados son imágenes, no archivos analíticos ni valores consultables. La serie de lluvia y otras cuencas no están incluidas en esta versión.

## Publicación

Publicar únicamente `index.html`, `visor.js`, `estilos.css`, `datos/` y `vendor/`, conservando los avisos de licencia de las bibliotecas. No incluir `exportar_qgis.py` ni carpetas de Lizmap, credenciales o archivos de configuración del servidor.
Las librerías Three.js y el mapa base OpenStreetMap requieren internet. El repositorio público y sus datos son accesibles a quien encuentre la dirección. Desactivar Pages no elimina copias descargadas ni el contenido del repositorio.

## Pruebas realizadas

- Exportación de 20 capas y malla de terreno válida.
- Vista 3D con TWI, clase final SHALSTAB y red hídrica simultáneos.
- Tres leyendas y opacidades independientes (25 %, 65 %, 65 %).
- Presentación inicial y reapertura desde el encabezado.
- Sin errores de consola en la prueba de superposición.
