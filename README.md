# Cuenca 2 · El Papayo · Visor 2D/3D

Visor estático independiente de QGIS Server, preparado para GitHub Pages.

## Funciones

- Capas 2D organizadas por grupo, transparencia y leyendas.
- Terreno 3D derivado del DEM, con máscara de datos válidos.
- Hasta seis superposiciones ráster o vectoriales renderizadas, con opacidad independiente y orden de abajo hacia arriba.
- Fondo DEM, OpenStreetMap o imagen satelital Esri en 3D; selector OSM/satelital en 2D.
- Exageración vertical 1–5× y restablecimiento de cámara.
- Presentación inicial y botón para volver a consultar datos, método, parámetros y límites del modelo.

## Representación

Las variables continuas seleccionadas se muestran con contraste P2–P98. Los valores extremos usan los colores terminales; no se cambian los archivos fuente ni los resultados. Las clases categóricas SHALSTAB conservan sus estilos.
El terreno se remuestrea a 256 × 256 para visualización. Las texturas UTM se componen sobre el terreno; las imágenes 2D se reproyectan a EPSG:3857. La luz 3D y las opacidades alteran el color percibido: consultar la leyenda y aislar una capa para interpretarla.
Los rásteres publicados son imágenes, no archivos analíticos ni valores consultables. La serie de lluvia y otras cuencas no están incluidas en esta versión.

## Nuevas capas de referencia

- `Clip_red_hidrica`: 79 elementos, estilo celeste del proyecto SHALSTAB Cuenca 2.
- `Clip_tectonica`: 16 elementos, color rojo del proyecto y grosor aumentado solo en el visor para facilitar su lectura; no representa ancho real de falla. Incluye tipos de falla normal y de rumbo. El atributo `Fuente` no documenta su procedencia: no interpretar como evidencia de actividad reciente ni como validación del mecanismo de movimiento.

Ambas están disponibles en 2D y en los seis selectores 3D. Su geometría 2D conserva el alcance original; en 3D la representación se limita a la superficie del DEM existente.

Los fondos externos se consultan solo al seleccionarlos y requieren internet y disponibilidad del proveedor. El fondo 3D usa un mosaico acotado (máximo 36 teselas, cuatro solicitudes simultáneas), reproyectado desde Web Mercator a la cuadrícula UTM con Proj4js. No se almacenan teselas en el repositorio, no hay descarga masiva/offline y se muestran los créditos del proveedor. La resolución es de contexto, no fotografía de detalle ni imagen en tiempo real. Si falla un fondo, se muestra el DEM con un aviso.

## Publicación

Publicar únicamente `index.html`, `visor.js`, `fondos.js`, `estilos.css`, `.nojekyll`, este README, `datos/` y `vendor/`, conservando los avisos de licencia de las bibliotecas. No incluir scripts Python de exportación ni carpetas de Lizmap, credenciales o archivos de configuración del servidor.
Las librerías Three.js y el mapa base OpenStreetMap requieren internet. El repositorio público y sus datos son accesibles a quien encuentre la dirección. Desactivar Pages no elimina copias descargadas ni el contenido del repositorio.

## Pruebas realizadas

- Exportación inicial de 20 capas y malla de terreno válida; actualización a 22 capas con las dos referencias nuevas.
- Vista 3D con TWI, clase final SHALSTAB y red hídrica simultáneos.
- Seis leyendas y opacidades independientes.
- Fondo satelital 3D probado con 20 teselas y créditos visibles.
- Presentación inicial y reapertura desde el encabezado.
- Sin errores de consola en la prueba de superposición.
