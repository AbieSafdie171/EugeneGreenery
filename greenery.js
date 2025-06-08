// maobox token
mapboxgl.accessToken = 'pk.eyJ1IjoiYXNhZmRpZSIsImEiOiJjbTh6MXZkb3AwNHdsMmpwbjl0cWE2c3N2In0.CJCiuaLVqFTE0ZjEhLzWfw';

// bounds
const bounds = [
  [-123.6580612, 43.7874626],
  [-122.650526, 44.14003163]
];

// basemap
const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/outdoors-v12',
  center: [-123.112355, 44.059128],
  zoom: 11,
  maxZoom: 18,
  minZoom: 10,
  maxBounds: bounds
});

// nav control
map.addControl(new mapboxgl.NavigationControl(), 'top-right');

// reset map button
document.getElementById('reset-zoom').addEventListener('click', () => {
  map.flyTo({
    center: [-123.112355, 44.059128],
    zoom: 11,
    essential: true
  });
});

// ------------------------------------------------------------------------
// getTopSpecies helpter function

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

// ------------------------------------------------------------------------
// on map load --- add all the geojson data

map.on('load', () => {
  // Add grid score source and layer
  map.addSource('score_map', {
    type: 'geojson',
    data: eugene_tree_map
  });

  // grid map choropleth map layer
  map.addLayer({
    id: 'grid-score-fill',
    type: 'fill',
    source: 'score_map',
    paint: {
      'fill-color': [
        'interpolate',
        ['linear'],
        ['get', 'Score'],
        0, '#7f001c',   // red end
        10, '#a50026',
        20, '#da372a',
        30, '#f67b4a',
        40, '#fdbf6f',
        50,  '#ffffbf',  // yellow
        60,  '#e0f3f8',
        70,  '#abd9e9',
        80,  '#74add1',
        90,  '#4575b4',
        100, '#313695'   // deep blue (best)
      ],
      'fill-opacity': 0.6
    }
  });

  // tree data 
  map.addSource('trees', {
    type: 'geojson',
    data: treesData,
    cluster: true,
    clusterMaxZoom: 14,
    clusterRadius: 50
  });

  // make the clusters
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

  // cluster count labels
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

  // individual tree points
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

// --------------------------------------------------------------------------------

// tree species filter panel


const { topSpecies, otherSpecies, counts } = getTopSpecies(treesData, 100); // get top 100 species by count
const filterContainer = document.getElementById('filters');
const selectedSpecies = new Set();  // save the current selected species

// search bar
const searchInput = document.createElement('input');
searchInput.type = 'text';
searchInput.placeholder = 'Search species...';
searchInput.style.width = '100%';
searchInput.style.marginBottom = '8px';
searchInput.style.padding = '4px';


// dropdown the search bar loads
const dropdown = document.createElement('div');
dropdown.style.maxHeight = '150px';
dropdown.style.overflowY = 'auto';
dropdown.style.background = '#fff';
dropdown.style.border = '1px solid #ccc';
dropdown.style.display = 'none';
dropdown.style.position = 'relative';
dropdown.style.zIndex = '10';

// put serach and dropdown on filter panel div
filterContainer.appendChild(searchInput);
filterContainer.appendChild(dropdown);

// select/deselct all button
const select_all_box = document.createElement('input');
select_all_box.type = 'checkbox';
select_all_box.id = 'select-all';
select_all_box.value = '__SELECT-ALL__';
select_all_box.checked = false;

const selectAllLabel = document.createElement('label');
selectAllLabel.setAttribute('for', 'select-all');
selectAllLabel.textContent = `Select/Deselect All`;

// putss at top of panel
filterContainer.appendChild(select_all_box);
filterContainer.appendChild(selectAllLabel);
filterContainer.appendChild(document.createElement('br'));

// save what is currently checked
const speciesCheckboxes = {};

// create checkboxes for each species
topSpecies.forEach(species => {
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.id = species;
  checkbox.value = species;
  checkbox.checked = false;
  speciesCheckboxes[species] = checkbox;
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

// checkbox for all other/unknown species
const otherCheckbox = document.createElement('input');
otherCheckbox.type = 'checkbox';
otherCheckbox.id = 'other-species';
otherCheckbox.value = '__OTHER__';
otherCheckbox.checked = false;
speciesCheckboxes['__OTHER__'] = otherCheckbox;
updateTreeFilter();

const otherLabel = document.createElement('label');
otherLabel.setAttribute('for', 'other-species');
otherLabel.textContent = `All Other/Unknown Species`;

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

// select/deselcted on change listener
select_all_box.addEventListener('change', () => {
  const selectAll = select_all_box.checked;
  Object.keys(speciesCheckboxes).forEach(species => {
    speciesCheckboxes[species].checked = selectAll;
    if (selectAll) {
      selectedSpecies.add(species);
    } else {
      selectedSpecies.delete(species);
    }
  });
  updateTreeFilter();
});



// search bar input and populating the dropdown

searchInput.addEventListener('input', () => {
  const query = searchInput.value.toLowerCase();
  dropdown.innerHTML = '';

  if (query.length === 0) {
    dropdown.style.display = 'none';
    return;
  }

  const matchingSpecies = Object.keys(speciesCheckboxes).filter(species => {
    if (species === '__OTHER__') {
      return 'other species'.includes(query) || query.includes('other');
    }
    return species.toLowerCase().includes(query);
  });

  if (matchingSpecies.length === 0) {
    dropdown.style.display = 'none';
    return;
  }

  matchingSpecies.forEach(species => {
    const option = document.createElement('div');
    option.textContent = option.textContent = species === '__OTHER__' ? 'All Other/Unknown Species' : species;
    option.style.padding = '5px';
    option.style.cursor = 'pointer';
    option.style.borderBottom = '1px solid #eee';

    option.addEventListener('click', () => {
      speciesCheckboxes[species].checked = true;
      selectedSpecies.add(species);
      updateTreeFilter();
      searchInput.value = '';
      dropdown.style.display = 'none';
    });

    dropdown.appendChild(option);
  });

  dropdown.style.display = 'block';
});

// hide dropdown when clicked out
document.addEventListener('click', (e) => {
  if (!filterContainer.contains(e.target)) {
    dropdown.style.display = 'none';
  }
});

// updates trees on map based on what is selected
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
// popups

// Grid score fill click popup
map.on('click', 'grid-score-fill', (e) => {

  const props = e.features[0].properties;

  // if we click on a tree, dont make the grid info pop up too logic

  const overlappingTrees = map.queryRenderedFeatures(e.point, {
    layers: ['unclustered-point']
  });

  const overlappingCluster = map.queryRenderedFeatures(e.point, {
    layers: ['clusters']
  });

  // console.log(overlappingTrees);
  // console.log(overlappingCluster);

  // if we clicked on another lyaer (tree/cluster) return bc we dont want to bring up the grid popup
  if (overlappingTrees.length > 0 || overlappingCluster.length > 0){
    return;
  }

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

  new mapboxgl.Popup()
    .setLngLat(e.lngLat)
    .setHTML(popupContent)
    .addTo(map);
});

// change cursor to pointer on grid fill hover
map.on('mouseenter', 'grid-score-fill', () => {
  map.getCanvas().style.cursor = 'pointer';
});
map.on('mouseleave', 'grid-score-fill', () => {
  map.getCanvas().style.cursor = '';
});

// change cursor to pointer on cluster hover
map.on('mouseenter', 'clusters', () => {
  map.getCanvas().style.cursor = 'pointer';
});
map.on('mouseleave', 'clusters', () => {
  map.getCanvas().style.cursor = '';
});

// zoom when cluster is clicked
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

// show data popup when clicking tree point
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

// chagng cursor on unclustered tree points hover
map.on('mouseenter', 'unclustered-point', () => {
  map.getCanvas().style.cursor = 'pointer';
});
map.on('mouseleave', 'unclustered-point', () => {
  map.getCanvas().style.cursor = '';
});

// -------------------------------------------------------


// Descroption panel. Code logic taken from assignment 3
var state = { panelOpen: true };

// defines a function that closes or opens the panel based on its current state
function panelSelect(e){
    if(state.panelOpen){
      document.getElementById('descriptionPanel').style.height = '26px';
      document.getElementById('glyph').className = "chevron glyphicon glyphicon-chevron-up";
      state.panelOpen = false;
    } else {
      document.getElementById('descriptionPanel').style.height = '455px';
      document.getElementById('glyph').className = "chevron glyphicon glyphicon-chevron-down";
      state.panelOpen = true;
    }
}


