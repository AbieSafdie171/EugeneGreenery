
// Set Mapbox token
mapboxgl.accessToken = 'pk.eyJ1IjoiYXNhZmRpZSIsImEiOiJjbTh6MXZkb3AwNHdsMmpwbjl0cWE2c3N2In0.CJCiuaLVqFTE0ZjEhLzWfw';

// Define bounds and map setup
const bounds = [
  [-123.6580612, 43.7874626],
  [-122.650526, 44.24003163]
];

// base map :)
const map = new mapboxgl.Map({
  container: 'map',
  style:    'mapbox://styles/mapbox/outdoors-v12',
  center: [-123.082355, 44.059128],
  zoom: 11,
  maxZoom: 18,
  minZoom: 10,
  maxBounds: bounds
});

// nav control
map.addControl(new mapboxgl.NavigationControl(), 'top-right');

// reset map to start
document.getElementById('reset-zoom').addEventListener('click', () => {
  map.flyTo({
    center: [-123.082355, 44.059128],
    zoom: 11,
    essential: true
  });
});

// ------------------------------------------------------------------------

// HELPER FUNCTIONS

function getTopSpecies(data, topN = 5) {
  const counts = {};

  // Count species occurrences, normalizing empty or null to "Unknown"
  data.features.forEach(f => {
    let species = f.properties.Tree_species;
    if (!species || species.trim() === '') {
      species = 'Unknown';
    }
    counts[species] = (counts[species] || 0) + 1;
  });

  // Sort species by count in descending order
  const sortedSpecies = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(entry => entry[0]);

  // Remove "Unknown" from the top species selection
  const filteredSorted = sortedSpecies.filter(species => species !== 'Unknown');

  const topSpecies = filteredSorted.slice(0, topN);

  // Everything else including "Unknown"
  const otherSpecies = sortedSpecies.filter(species => !topSpecies.includes(species));


  console.log(otherSpecies);

  return { topSpecies, otherSpecies, counts };
}

function countOther(data) {
  let count = 0;

  data.features.forEach(f => {
    let species = f.properties.Tree_species;
    const types = [
      "Pseudotsuga menziesii - Douglas fir",
      "Acer rubrum - red maple",
      "Quercus garryana - Oregon white oak",
      "Acer macrophyllum - bigleaf maple",
      "Acer platanoides - Norway maple"
    ];
    if (!types.includes(species)) {
      count++;
    }
  });
  return count;
}



// Add geojson data of all the trees

map.on('load', () => {
  // Add source from the inline variable

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
       0, '#a50026',   // red
      10, '#a50026',
      20, '#da372a',
      30, '#f67b4a',
      40, '#fdbf6f',
      50, '#feeea2',   // yellow
      60, '#eaf6a2',
      70, '#b7e075',
      80, '#74c365',
      90, '#229c52',
     100, '#006837'    // green
    ],
    'fill-opacity': 0.6
  }
});


  map.addSource('trees', {
    type: 'geojson',
    data: treesData,
    cluster: true,
    clusterMaxZoom: 14,
    clusterRadius: 50
  });

  // Clustered layer
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

  // 1. Count species frequency
  const { topSpecies, otherSpecies, counts } = getTopSpecies(treesData, 5);

  const filterContainer = document.getElementById('filters');

  const selectedSpecies = new Set(topSpecies.concat(['__OTHER__'])); // start with all selected

  topSpecies.forEach(species => {
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = species;
    checkbox.value = species;
    checkbox.checked = true;

    const label = document.createElement('label');
    const amount = counts[checkbox.id]
    label.setAttribute('for', species);

    label.textContent = `${species} (${amount})`;  // "Maple (42)"

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



  // Add 'Other' checkbox
  const otherCheckbox = document.createElement('input');
  const others_amount = countOther(treesData);
  otherCheckbox.type = 'checkbox';
  otherCheckbox.id = 'other-species';
  otherCheckbox.value = '__OTHER__';
  otherCheckbox.checked = true;

  const otherLabel = document.createElement('label');
  otherLabel.setAttribute('for', 'other-species');
  otherLabel.textContent = `Other (${others_amount})`;

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

  // 2. Update tree filter logic
  function updateTreeFilter() {
    const activeSpecies = [];

    if (topSpecies.some(s => selectedSpecies.has(s))) {
      activeSpecies.push(...topSpecies.filter(s => selectedSpecies.has(s)));
    }

    if (selectedSpecies.has('__OTHER__')) {
      activeSpecies.push(...otherSpecies);
    }

    // Filter treesData.features
    const filteredFeatures = treesData.features.filter(f => {
      const species = f.properties.Tree_species || 'Unknown';
      return activeSpecies.includes(species);
    });

    // Update the map source with the new filtered data
    const filteredGeojson = {
      type: 'FeatureCollection',
      features: filteredFeatures
    };

    map.getSource('trees').setData(filteredGeojson);
  }



});

// Change cursor to pointer when over clusters
map.on('mouseenter', 'clusters', () => {
  map.getCanvas().style.cursor = 'pointer';
});
map.on('mouseleave', 'clusters', () => {
  map.getCanvas().style.cursor = '';
});

// Zoom into cluster on single click
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

// show the data associated with each tree when clicked on

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

map.on('mouseenter', 'unclustered-point', () => {
  map.getCanvas().style.cursor = 'pointer';
});
map.on('mouseleave', 'unclustered-point', () => {
  map.getCanvas().style.cursor = '';
});

// ------------------------------------------------------------------------