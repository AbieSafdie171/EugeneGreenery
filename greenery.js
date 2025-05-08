
// Our mapbox token
mapboxgl.accessToken = 'pk.eyJ1IjoiYXNhZmRpZSIsImEiOiJjbTh6MXZkb3AwNHdsMmpwbjl0cWE2c3N2In0.CJCiuaLVqFTE0ZjEhLzWfw';

  var bounds = [
      [-123.6580612, 43.7874626], // Southwest coordinates
      [-122.650526, 44.24003163] // Northeast coordinates 
  ];

// initialize the map
var map = new mapboxgl.Map({
     container: 'map', // container id
     style: 'mapbox://styles/mapbox/dark-v10',
     center: [-123.082355, 44.045628],
     zoom: 11,
     maxZoom: 15,
     minZoom: 10,
     maxBounds: bounds
});

// Add zoom and rotation controls to the map.
const nav = new mapboxgl.NavigationControl();

// moves the navigation control to the top-left corner
map.addControl(nav, 'top-right');


// Reset Zoom button that resets map to original
document.getElementById('reset-zoom').addEventListener('click', function() {
    map.flyTo({
        center: [-123.082355, 44.045628], // Original center
        zoom: 11, // Original zoom level
        essential: true
    });
});

