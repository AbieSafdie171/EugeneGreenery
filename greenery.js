// Set Mapbox token
mapboxgl.accessToken = 'pk.eyJ1IjoiYXNhZmRpZSIsImEiOiJjbTh6MXZkb3AwNHdsMmpwbjl0cWE2c3N2In0.CJCiuaLVqFTE0ZjEhLzWfw';

// Define bounds and map setup
const bounds = [
  [-123.6580612, 43.7874626],
  [-122.650526, 44.14003163]
];

// Base map setup
const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/outdoors-v12',
  center: [-123.112355, 44.059128],
  zoom: 11,
  maxZoom: 18,
  minZoom: 10,
  maxBounds: bounds
});

// Add navigation control (zoom buttons, compass)
map.addControl(new mapboxgl.NavigationControl(), 'top-right');

// Reset map to start position on button click
document.getElementById('reset-zoom').addEventListener('click', () => {
  map.flyTo({
    center: [-123.112355, 44.059128],
    zoom: 11,
    essential: true
  });
});

// ------------------------------------------------------------------------
// HELPER FUNCTIONS

function getTopSpecies(data, topN = 5) {
  const counts = {};

  // Count species occurrences, normalize empty or null to "Unknown"
  data.features.forEach(f => {
    let species = f.properties.Tree_species;
    if (!species || species.trim() === '') {
      species = 'Unknown';
    }
    counts[species] = (counts[species] || 0) + 1;
  });

  // Sort species by descending count
  const sortedSpecies = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(entry => entry[0]);

  // Remove "Unknown" from top species
  const filteredSorted = sortedSpecies.filter(species => species !== 'Unknown');

  const topSpecies = filteredSorted.slice(0, topN);
  const otherSpecies = sortedSpecies.filter(species => !topSpecies.includes(species));

  return { topSpecies, otherSpecies, counts };
}

function countOther(data) {
  let count = 0;
  const knownTypes = [
    "Pseudotsuga menziesii - Douglas fir",
    "Acer rubrum - red maple",
    "Quercus garryana - Oregon white oak",
    "Acer macrophyllum - bigleaf maple",
    "Acer platanoides - Norway maple"
  ];

  data.features.forEach(f => {
    const species = f.properties.Tree_species;
    if (!knownTypes.includes(species)) {
      count++;
    }
  });

  return count;
}

// ------------------------------------------------------------------------
// MAP LOAD EVENT

map.on('load', () => {
  // Add grid score source and layer
  map.addSource('score_map', {
    type: 'geojson',
    data: eugene_tree_map
  });

  map.addLayer({
    id: 'grid-score-fill',
    type: 'fill',
    source: 'score_map',
    paint: {
      'fill-color': [
        'interpolate',
        ['linear'],
        ['get', 'Score'],
        0, '#7f001c',   // darker red
        10, '#a50026',
        20, '#da372a',
        30, '#f67b4a',
        40, '#fdbf6f',
        50, '#feeea2',  // yellow
        60, '#eaf6a2',
        70, '#b7e075',
        80, '#74c365',
        90, '#229c52',
        100, '#006837'  // green
      ],
      'fill-opacity': 0.6
    }
  });

  // Add trees source with clustering
  map.addSource('trees', {
    type: 'geojson',
    data: treesData,
    cluster: true,
    clusterMaxZoom: 14,
    clusterRadius: 50
  });

  // Clustered circles layer
  map.addLayer({
    id: 'clusters',
    type: 'circle',
    source: 'trees',
    filter: ['has', 'point_count'],
    paint: {
      'circle-color': '#44a04c',
      'circle-radius': ['step', ['get', 'point_count'], 15, 100, 20, 750, 25]
    }
  });

  // Cluster count labels
  map.addLayer({
    id: 'cluster-count',
    type: 'symbol',
    source: 'trees',
    filter: ['has', 'point_count'],
    layout: {
      'text-field': '{point_count_abbreviated}',
      'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
      'text-size': 12
    },
    paint: {
      'text-color': '#000000'
    }
  });

  // Unclustered tree points
  map.addLayer({
    id: 'unclustered-point',
    type: 'circle',
    source: 'trees',
    filter: ['!', ['has', 'point_count']],
    paint: {
      'circle-color': '#006400',
      'circle-radius': 4,
      'circle-opacity': 0.7
    }
  });

  // Species filtering UI
  const { topSpecies, otherSpecies, counts } = getTopSpecies(treesData, 5);
  const filterContainer = document.getElementById('filters');
  const selectedSpecies = new Set();

  // Create checkboxes for top species
  topSpecies.forEach(species => {
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = species;
    checkbox.value = species;
    checkbox.checked = false;
    updateTreeFilter();

    const label = document.createElement('label');
    label.setAttribute('for', species);
    label.textContent = `${species} (${counts[species]})`;

    filterContainer.appendChild(checkbox);
    filterContainer.appendChild(label);
    filterContainer.appendChild(document.createElement('br'));

    checkbox.addEventListener('change', () => {
      if (checkbox.checked) {
        selectedSpecies.add(species);
      } else {
        selectedSpecies.delete(species);
      }
      updateTreeFilter();
    });
  });

  // Create checkbox for "Other" species
  const otherCheckbox = document.createElement('input');
  otherCheckbox.type = 'checkbox';
  otherCheckbox.id = 'other-species';
  otherCheckbox.value = '__OTHER__';
  otherCheckbox.checked = false;
  updateTreeFilter();

  const otherLabel = document.createElement('label');
  otherLabel.setAttribute('for', 'other-species');
  otherLabel.textContent = `Other (${countOther(treesData)})`;

  filterContainer.appendChild(otherCheckbox);
  filterContainer.appendChild(otherLabel);
  filterContainer.appendChild(document.createElement('br'));

  otherCheckbox.addEventListener('change', () => {
    if (otherCheckbox.checked) {
      selectedSpecies.add('__OTHER__');
    } else {
      selectedSpecies.delete('__OTHER__');
    }
    updateTreeFilter();
  });

  // Update tree filter function
  function updateTreeFilter() {
    const activeSpecies = [];

    if (topSpecies.some(s => selectedSpecies.has(s))) {
      activeSpecies.push(...topSpecies.filter(s => selectedSpecies.has(s)));
    }

    if (selectedSpecies.has('__OTHER__')) {
      activeSpecies.push(...otherSpecies);
    }

    const filteredFeatures = treesData.features.filter(f => {
      const species = f.properties.Tree_species || 'Unknown';
      return activeSpecies.includes(species);
    });

    const filteredGeojson = {
      type: 'FeatureCollection',
      features: filteredFeatures
    };

    map.getSource('trees').setData(filteredGeojson);
  }
});

// ------------------------------------------------------------------------
// POPUPS AND CURSOR INTERACTIONS

// Grid score fill click popup
map.on('click', 'grid-score-fill', (e) => {

  const props = e.features[0].properties;

  const overlappingTrees = map.queryRenderedFeatures(e.point, {
    layers: ['unclustered-point']
  });

  console.log(overlappingTrees);

  if (overlappingTrees.length > 0){
    return;
  }

  // Offset the grid popup 50px right only if a tree is also clicked
  const offset = overlappingTrees.length > 0 ? [0, -100] : [0, 0];

  const popupContent = `
    <strong>Grid ID:</strong> ${props.Grid_ID || 'N/A'}<br>
    <strong>Total Parks:</strong> ${props.Num_Parks || 'N/A'}<br>
    <strong>Total Trees:</strong> ${props.Num_Trees || 'N/A'}<br>
    <strong>Total Spread:</strong> ${props.SUM_spread || 'N/A'}<br>
    <strong>Total Height:</strong> ${props.SUM_height || 'N/A'}<br>
    <strong>Total Unique Species:</strong> ${props.COUNT_Species || 'N/A'}<br>
    <strong>Most Common Species:</strong> ${props.Common_Species || 'N/A'}<br>
    <strong>Score:</strong> ${props.Score ? Number(props.Score).toFixed(2) : 'N/A'}<br>
  `;

  new mapboxgl.Popup({ offset })
    .setLngLat(e.lngLat)
    .setHTML(popupContent)
    .addTo(map);
});

// Change cursor to pointer on grid fill hover
map.on('mouseenter', 'grid-score-fill', () => {
  map.getCanvas().style.cursor = 'pointer';
});
map.on('mouseleave', 'grid-score-fill', () => {
  map.getCanvas().style.cursor = '';
});

// Change cursor to pointer on cluster hover
map.on('mouseenter', 'clusters', () => {
  map.getCanvas().style.cursor = 'pointer';
});
map.on('mouseleave', 'clusters', () => {
  map.getCanvas().style.cursor = '';
});

// Zoom into cluster on click
map.on('click', 'clusters', (e) => {
  const features = map.queryRenderedFeatures(e.point, {
    layers: ['clusters']
  });

  const clusterId = features[0].properties.cluster_id;
  map.getSource('trees').getClusterExpansionZoom(clusterId, (err, zoom) => {
    if (err) return;

    map.easeTo({
      center: features[0].geometry.coordinates,
      zoom: zoom
    });
  });
});

// Show data popup when clicking unclustered tree points
map.on('click', 'unclustered-point', (e) => {
  const feature = e.features[0];
  const props = feature.properties;

  const popupContent = `
    <strong>Species:</strong> ${props.Tree_species || 'Unknown'}<br>
    <strong>Height:</strong> ${props.height || 'N/A'}<br>
    <strong>Spread:</strong> ${props.spread || 'N/A'}
  `;

  new mapboxgl.Popup()
    .setLngLat(feature.geometry.coordinates)
    .setHTML(popupContent)
    .addTo(map);

});

// Change cursor on unclustered tree points hover
map.on('mouseenter', 'unclustered-point', () => {
  map.getCanvas().style.cursor = 'pointer';
});
map.on('mouseleave', 'unclustered-point', () => {
  map.getCanvas().style.cursor = '';
});

var state = { panelOpen: true };

// defines a function that closes or opens the panel based on its current state
function panelSelect(e){
    if(state.panelOpen){
      document.getElementById('descriptionPanel').style.height = '26px';
      document.getElementById('glyph').className = "chevron glyphicon glyphicon-chevron-up";
      state.panelOpen = false;
    } else {
      document.getElementById('descriptionPanel').style.height = '450px';
      document.getElementById('glyph').className = "chevron glyphicon glyphicon-chevron-down";
      state.panelOpen = true;
    }
}
