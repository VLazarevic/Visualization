/* ---------- TF (transfer-function) chart size ---------- */
const TF_WIDTH = 500;               // full SVG width
const TF_HEIGHT = TF_WIDTH / 2;      // full SVG height
const TF_MARGIN = { top: 10, right: 60, bottom: 40, left: 40 };
const TF_ADJ_WIDTH = TF_WIDTH - TF_MARGIN.left - TF_MARGIN.right;  // drawable area
const TF_ADJ_HEIGHT = TF_HEIGHT - TF_MARGIN.top - TF_MARGIN.bottom;

const MAX_LAYERS = 3;
let layerIdx = 0;

let renderer, camera, scene, orbitCamera;
let canvasWidth, canvasHeight = 0;
let container = null;
let volume = null;
let fileInput = null;
let firstHitShader = null;
let cuttingPlaneEditor = null;

let cursor_y;
let cursor_x;

let isoValues = [0.5, -1, -1];
let surfaceColors = [new THREE.Vector3(1, 1, 1), new THREE.Vector3(1, 1, 1), new THREE.Vector3(1, 1, 1)];
let opacities = [1.0, -1, -1];

let theColorRgb = new THREE.Vector3(255, 255, 255);



/**
 * Initializes the main application components.
 */
function init() {
    // Volume viewer container
    container = document.getElementById("viewContainer");
    canvasHeight = window.innerHeight * 0.7;
    canvasWidth = window.innerWidth * 0.7;

    // WebGL renderer
    renderer = new THREE.WebGLRenderer();
    renderer.setSize(canvasWidth, canvasHeight);
    container.appendChild(renderer.domElement);

    // Read and parse volume file
    fileInput = document.getElementById("upload");
    fileInput.addEventListener('change', readFile);

    // Create new first hit shader
    firstHitShader = new FirstHitShader();

    saveButtonPress();
    deleteButtonPress();

    // Initialize SSAO parameters
    firstHitShader.material.uniforms.ssaoRadius = { value: 0.5 };
    firstHitShader.material.uniforms.ssaoBias = { value: 0.025 };
    firstHitShader.material.uniforms.ssaoStrength = { value: 1.0 };

    // Initialize SSAO controls
    initSSAOControls();

    firstHitShader.setIsoValues(isoValues);
    firstHitShader.setSurfaceColors(surfaceColors);
    firstHitShader.setOpacities(opacities);

    // Color changing for transfer function
    var colorInput = document.getElementById("surfaceColor");
    colorInput.addEventListener("input", function () {
        let theColor = colorInput.value;
        theColorRgb = hexToRgb(theColor);
        surfaceColors[layerIdx] = new THREE.Vector3(theColorRgb.x / 255.0, theColorRgb.y / 255.0, theColorRgb.z / 255.0);
        firstHitShader.setSurfaceColors(surfaceColors);
        paint();
    }, false);

    // Initialize the cutting plane editor
    cuttingPlaneEditor = new CuttingPlaneEditor(firstHitShader, paint, updateHistogramForCuttingPlane);
    cuttingPlaneEditor.init();
}

function initSSAOControls() {
    // SSAO Radius control
    document.getElementById('ssaoRadius').addEventListener('input', function() {
        firstHitShader.material.uniforms.ssaoRadius.value = parseFloat(this.value);
        paint();
    });

    // SSAO Bias control
    document.getElementById('ssaoBias').addEventListener('input', function() {
        firstHitShader.material.uniforms.ssaoBias.value = parseFloat(this.value);
        paint();
    });

    // SSAO Strength control
    document.getElementById('ssaoStrength').addEventListener('input', function() {
        firstHitShader.material.uniforms.ssaoStrength.value = parseFloat(this.value);
        paint();
    });
}

/**
 * Handles the save button press for transfer function layers.
 */
function saveButtonPress() {
    document.getElementById('saveButton').addEventListener("click", function () {
        if (layerIdx === MAX_LAYERS) {
            alert("Maximum number of layers reached.");
            return;
        }

        updateValues();

        surfaceColors[layerIdx] = new THREE.Vector3(theColorRgb.x / 255.0, theColorRgb.y / 255.0, theColorRgb.z / 255.0);
        firstHitShader.setSurfaceColors(surfaceColors);

        layerIdx++;
        document.getElementById('surfaceColor').value = '#ffffff';
        updateSlider();

        cursor_x = 0.5;
        cursor_y = 1.0;
        resetLiveSlider();
        createLiveSlider();
    });
}

/**
 * Updates the iso values and opacities for the current layer.
 */
function updateValues() {
    if (isoValues[layerIdx] === -1) {
        isoValues[layerIdx] = cursor_x;
        firstHitShader.setIsoValues(isoValues);
        opacities[layerIdx] = cursor_y;
        firstHitShader.setOpacities(opacities);
    }
    paint();
}

/**
 * Updates the visual representation of saved transfer function layers.
 */
function updateSlider() {
    const svg = d3.select('#tfContainer').select('svg').select('g');

    svg.selectAll(".saved-line").remove();
    svg.selectAll(".saved-circle").remove();

    for (let i = 0; i < layerIdx; i++) {
        const newX = isoValues[i] * TF_ADJ_WIDTH;
        const newY = (opacities[i] - 1) * -1 * TF_ADJ_HEIGHT;

        svg.insert("line", ":first-child")
            .attr("x1", newX)
            .attr("x2", newX)
            .attr("y1", newY)
            .attr("y2", TF_ADJ_HEIGHT)
            .attr("class", "saved-line")
            .style("stroke", "rgb(" + surfaceColors[i].x * 255 + ", " + surfaceColors[i].y * 255 + ", " + surfaceColors[i].z * 255 + ")")
            .style("stroke-width", "2px");

        svg.insert("circle", ":first-child")
            .attr("cx", newX)
            .attr("cy", newY)
            .attr("r", 10)
            .attr("class", "saved-circle")
            .style("fill", "rgb(" + surfaceColors[i].x * 255 + ", " + surfaceColors[i].y * 255 + ", " + surfaceColors[i].z * 255 + ")")
            .style("stroke-width", "2px");
    }
}

/**
 * Resets the live slider on the transfer function chart.
 */
function resetLiveSlider() {
    const svg = d3.select('#tfContainer').select('svg').select('g');
    svg.selectAll('.live-line').remove();
    svg.selectAll('.live-ball').remove();
}

/**
 * Creates the interactive live slider on the transfer function chart.
 */
function createLiveSlider() {
    const svg = d3.select('#tfContainer').select('svg').select('g');

    drawSliderElement(svg, TF_ADJ_WIDTH, TF_ADJ_HEIGHT, function (density, intensity) {
        cursor_x = density;
        cursor_y = intensity;

        if (layerIdx !== MAX_LAYERS) {
            isoValues[layerIdx] = cursor_x;
            opacities[layerIdx] = cursor_y;
            firstHitShader.setIsoValues(isoValues);
            firstHitShader.setOpacities(opacities);
            paint();
        }
    }, true);
}

/**
 * Handles the delete button press for transfer function layers.
 */
function deleteButtonPress() {
    document.getElementById('deleteButton').addEventListener("click", function () {
        if (layerIdx <= 0) {
            alert("No layers to delete.");
            return;
        }

        layerIdx--;

        isoValues[layerIdx] = -1;
        opacities[layerIdx] = -1;

        surfaceColors[layerIdx] = new THREE.Vector3(1, 1, 1);

        document.getElementById('surfaceColor').value = '#ffffff';
        updateSlider();
        paint();
    });
}

/**
 * Converts a hex color string to an RGB THREE.Vector3.
 * @param {string} hexStr - The hex color string (e.g., "#RRGGBB" or "#RGB").
 * @returns {THREE.Vector3} - The RGB color as a Vector3 (0-255).
 */
function hexToRgb(hexStr) {
    // strip leading “#” if present
    const raw = hexStr.replace(/^#/, '');

    // expand 3-digit form (#abc ➜ #aabbcc)
    const full = raw.length === 3
        ? raw.split('').map(ch => ch + ch).join('')
        : raw;

    // convert to integer and split into RGB bytes
    const intVal = parseInt(full, 16);
    const r = (intVal >> 16) & 0xff;
    const g = (intVal >> 8) & 0xff;
    const b = intVal & 0xff;

    return new THREE.Vector3(r, g, b);
}

/**
 * Creates or updates the density histogram using D3.js.
 * @param {Array<number>} voxels - The array of voxel density values.
 */
function createHistogram(voxels) {
    const container = d3.select("#tfContainer");

    const width = 500;
    const height = width / 2;
    const margin = { top: 10, right: 60, bottom: 40, left: 40 };
    const TF_ADJ_WIDTH = width - margin.left - margin.right;
    const TF_ADJ_HEIGHT = height - margin.top - margin.bottom;

    let svg = container.select('svg');
    if (svg.empty()) {
        svg = container.append('svg')
            .attr('width', '100%')
            .attr('height', '100%')
            .append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        svg.append('g').attr('class', 'x-axis').attr('transform', `translate(0,${TF_ADJ_HEIGHT})`);
        svg.append('g').attr('class', 'y-axis');
    }

    // Scales
    const xScale = d3.scaleLinear().domain([0, 1]).range([0, TF_ADJ_WIDTH]);
    const yScale = d3.scaleLinear().domain([0, 1]).range([TF_ADJ_HEIGHT, 0]);

    const histogram = d3.histogram()
        .value(d => d)
        .domain(xScale.domain())
        .thresholds(xScale.ticks(100));

    const bins = histogram(voxels);
    const yScaleDown = d3.scalePow()
        .exponent(0.25)
        .domain([0, d3.max(bins, d => d.length) * 1.5])
        .range([0, TF_ADJ_HEIGHT]);

    // Axes
    svg.select('.x-axis').call(d3.axisBottom(xScale));
    svg.select('.y-axis').call(d3.axisLeft(yScale));

    // Axis labels (once only)
    if (svg.selectAll('.x-axis-label').empty()) {
        svg.select('.x-axis').append('text')
            .attr('class', 'x-axis-label')
            .attr('x', TF_ADJ_WIDTH).attr('y', 40)
            .attr('text-anchor', 'end').attr('fill', 'white')
            .text('Density');

        svg.select('.y-axis').append('text')
            .attr('class', 'y-axis-label')
            .attr('transform', 'rotate(-90)')
            .attr('y', -40).attr('dy', '.75em')
            .attr('text-anchor', 'end').attr('fill', 'white')
            .text('Intensity');
    }

    // Draw histogram bars
    const bars = svg.selectAll('rect').data(bins);

    bars.enter().append('rect')
        .attr('x', d => xScale(d.x0))
        .attr('width', d => Math.max(0, xScale(d.x1) - xScale(d.x0) - 1))
        .attr('height', 0)
        .style('fill', 'white')
        .merge(bars)
        .transition().duration(1000)
        .attr('y', TF_ADJ_HEIGHT)
        .attr('height', d => yScaleDown(d.length))
        .style('opacity', 0.3);

    bars.exit().transition().duration(1000)
        .attr('y', TF_ADJ_HEIGHT).attr('height', 0)
        .remove();

    resetLiveSlider();
    createLiveSlider();
}

/**
 * Reads and parses the uploaded volume file.
 */
async function readFile() {
    let reader = new FileReader();
    reader.onloadend = function () {
        console.log("data loaded: ");

        let data = new Uint16Array(reader.result);
        volume = new Volume(data);
        createHistogram(volume.voxels);

        // Set shader data
        firstHitShader.setVolume(volume);
        firstHitShader.setSteps(500);

        requestAnimationFrame(() => {
            resetVis();
        });
    };
    reader.readAsArrayBuffer(fileInput.files[0]);
}

/**
 * Resets the visualization, setting up a new scene and camera.
 */
async function resetVis() {
    // Fresh scene graph and perspective camera
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, canvasWidth / canvasHeight, 0.1, 1000);

    // Create a box matching the volume’s dimensions and wrap it with the shader material
    const bboxGeom = new THREE.BoxGeometry(volume.width, volume.height, volume.depth);
    const volumeShader = firstHitShader.material;

    await firstHitShader.load();
    const volumeMesh = new THREE.Mesh(bboxGeom, volumeShader);
    scene.add(volumeMesh);

    // Update the cutting plane editor with the new volume reference
    if (cuttingPlaneEditor) {
        cuttingPlaneEditor.setVolume(volume);
        cuttingPlaneEditor.updatePlane();
    }

    // Place an orbit camera that circles around the origin
    orbitCamera = new OrbitCamera(
        camera,
        new THREE.Vector3(0, 0, 0),
        2 * volume.max,
        renderer.domElement
    );

    // Kick off the render loop
    requestAnimationFrame(paint);
}

/**
 * Renders the scene.
 */
function paint() {
    if (volume) {
        renderer.render(scene, camera);
    }
}

/**
 * Updates the histogram to reflect only the voxels visible through the cutting plane.
 */
function updateHistogramForCuttingPlane() {
    if (volume && firstHitShader && firstHitShader.material) {
        const planeNormal = new THREE.Vector3(
            firstHitShader.material.uniforms.uPlane.value.x,
            firstHitShader.material.uniforms.uPlane.value.y,
            firstHitShader.material.uniforms.uPlane.value.z
        ).normalize();
        const planeD = firstHitShader.material.uniforms.uPlane.value.w;
        const renderAbove = firstHitShader.material.uniforms.uRenderAbove.value === 1.0;

        const visibleVoxels = [];
        for (let z = 0; z < volume.depth; z++) {
            for (let y = 0; y < volume.height; y++) {
                for (let x = 0; x < volume.width; x++) {
                    // Normalize world coordinates to [-0.5, 0.5] for consistency with shader
                    const worldX = x / volume.width - 0.5;
                    const worldY = y / volume.height - 0.5;
                    const worldZ = z / volume.depth - 0.5;

                    const dotProduct = planeNormal.x * worldX + planeNormal.y * worldY + planeNormal.z * worldZ;

                    if ((renderAbove && dotProduct > -planeD) || (!renderAbove && dotProduct < -planeD)) {
                        const index = x + y * volume.width + z * volume.width * volume.height;
                        visibleVoxels.push(volume.voxels[index]);
                    }
                }
            }
        }
        createHistogram(visibleVoxels);
    }
}

/**
 * Draws a slider element on the D3.js SVG.
 * @param {d3.Selection} svg - The D3 selection of the SVG group to draw on.
 * @param {number} adjWidth - The adjusted width of the drawing area.
 * @param {number} adjHeight - The adjusted height of the drawing area.
 * @param {function} onDragCallback - Callback function for drag events.
 * @param {boolean} isLive - True if it's a live slider, false for saved.
 */
function drawSliderElement(svg, adjWidth, adjHeight, onDragCallback, isLive = false) {
    const classSuffix = isLive ? 'live' : 'saved';

    const initialX = isLive && typeof cursor_x !== 'undefined' ? cursor_x * adjWidth : adjWidth / 2;
    const initialY = isLive && typeof cursor_y !== 'undefined' ? (1 - cursor_y) * adjHeight : adjHeight / 2;

    const line = svg.append("line")
        .attr("x1", initialX)
        .attr("x2", initialX)
        .attr("y1", initialY)
        .attr("y2", adjHeight)
        .attr("class", `${classSuffix}-line`)
        .style("stroke", "white")
        .style("stroke-width", "2px")
        .style("cursor", "pointer");

    if (isLive) {
        // Dashed line for live slider
        line.style("stroke-dasharray", "6,3");
    }

    const ball = svg.append("circle")
        .attr("cx", initialX)
        .attr("cy", initialY)
        .attr("r", 10)
        .attr("class", `${classSuffix}-ball`)
        .style("fill", "white")
        .style("stroke-width", "2px")
        .style("cursor", "pointer");

    const drag = d3.drag().on("drag", function (event) {
        const newX = Math.max(0, Math.min(adjWidth, event.x));
        const newY = Math.max(0, Math.min(adjHeight, event.y));

        line.attr("x1", newX).attr("x2", newX).attr("y1", newY).attr("y2", adjHeight);
        ball.attr("cx", newX).attr("cy", newY);

        const normalizedX = newX / adjWidth;
        const normalizedY = 1 - (newY / adjHeight);

        onDragCallback(normalizedX, normalizedY);
    });

    line.call(drag);
    ball.call(drag);
}