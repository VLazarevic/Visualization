/* ---------- TF (transfer-function) chart size ---------- */
const TF_WIDTH  = 500;               // full SVG width
const TF_HEIGHT = TF_WIDTH / 2;      // full SVG height
const TF_MARGIN = { top: 10, right: 60, bottom: 40, left: 40 };
const TF_ADJ_WIDTH = TF_WIDTH  - TF_MARGIN.left - TF_MARGIN.right;  // drawable area
const TF_ADJ_HEIGHT = TF_HEIGHT - TF_MARGIN.top  - TF_MARGIN.bottom;

const MAX_LAYERS = 4;
let layerIdx = 0;

let renderer, camera, scene, orbitCamera;
let canvasWidth, canvasHeight = 0;
let container = null;
let volume = null;
let fileInput = null;
let firstHitShader = null;

let cursor_x;
let cursor_y;


let isoValues = [0.5, -1, -1]; // Example iso-values
let surfaceColors = [new THREE.Vector3(1, 1, 1), new THREE.Vector3(1, 1, 1), new THREE.Vector3(1, 1, 1)];

let opacities = [1.0, -1, -1]; // Example opacities

let theColorRgb = new THREE.Vector3(255, 255, 255);



function init() {
    // volume viewer
    container = document.getElementById("viewContainer");
    canvasWidth = window.innerWidth * 0.7;
    canvasHeight = window.innerHeight * 0.7;

    // WebGL renderer
    renderer = new THREE.WebGLRenderer();
    renderer.setSize( canvasWidth, canvasHeight );
    container.appendChild( renderer.domElement );

    // read and parse volume file
    fileInput = document.getElementById("upload");
    fileInput.addEventListener('change', readFile);

    // create new maximum intensity projection shader
    firstHitShader = new FirstHitShader();

    saveButtonPress();
    deleteButtonPress();

    firstHitShader.setIsoValues(isoValues);
    firstHitShader.setSurfaceColors(surfaceColors);
    firstHitShader.setOpacities(opacities);


    // color changing
    var colorInput = document.getElementById("surfaceColor");

    colorInput.addEventListener("input", function () {
        let theColor = colorInput.value;

        theColorRgb = hexToRgb(theColor);

        surfaceColors[layerIdx] = new THREE.Vector3(theColorRgb.x / 255.0, theColorRgb.y / 255.0, theColorRgb.z / 255.0)
        firstHitShader.setSurfaceColors(surfaceColors);
        paint();
    }, false);
}

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


function updateValues() {
    if (isoValues[layerIdx] === -1) {
        isoValues[layerIdx] = cursor_x;
        firstHitShader.setIsoValues(isoValues);
        opacities[layerIdx] = cursor_y;
        firstHitShader.setOpacities(opacities);
    }
    paint();
}

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
            .style("stroke-width", "2px")

        svg.insert("circle", ":first-child")
            .attr("cx", newX)
            .attr("cy", newY)
            .attr("r", 10)
            .attr("class", "saved-circle")
            .style("fill", "rgb(" + surfaceColors[i].x * 255 + ", " + surfaceColors[i].y * 255 + ", " + surfaceColors[i].z * 255 + ")")
            .style("stroke-width", "2px")
    }
}

function resetLiveSlider() {
    const svg = d3.select('#tfContainer').select('svg').select('g');
    svg.selectAll('.live-line').remove();
    svg.selectAll('.live-ball').remove();
}



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
    })
}

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
    const g = (intVal >>  8) & 0xff;
    const b =  intVal        & 0xff;

    return new THREE.Vector3(r, g, b);
}

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

async function readFile() {
    let reader = new FileReader();
    reader.onloadend = function () {
        console.log("data loaded: ");

        let data = new Uint16Array(reader.result);
        volume = new Volume(data);
        createHistogram(volume.voxels);

        // set shader data
        firstHitShader.setVolume(volume);
        firstHitShader.setSteps(500);

        requestAnimationFrame(() => {
            resetVis();
        });
    };
    reader.readAsArrayBuffer(fileInput.files[0]);
}

async function resetVis() {
    // create new empty scene and perspective camera
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, canvasWidth / canvasHeight, 0.1, 1000);


    const boundingBox = new THREE.BoxGeometry(volume.width, volume.height, volume.depth); // create bounding box in which we render the volume
    const material = firstHitShader.material;
    await firstHitShader.load(); // this function needs to be called explicitly, and only works within an async function!
    const mesh = new THREE.Mesh(boundingBox, material);
    scene.add(mesh);

    setupCuttingPlaneUI();

    // our camera orbits around an object centered at (0,0,0)
    orbitCamera = new OrbitCamera(camera, new THREE.Vector3(0, 0, 0), 2 * volume.max, renderer.domElement);

    // init paint loop
    requestAnimationFrame(paint);
}

function paint() {
    if (volume) {
        renderer.render(scene, camera);
    }
}

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
                    const worldX = x / volume.width - 0.5;
                    const worldY = y / volume.height - 0.5;
                    const worldZ = z / volume.depth - 0.5;

                    const dotProduct = planeNormal.x * worldX + planeNormal.y * worldY + planeNormal.z * worldZ;

                    if ((renderAbove && dotProduct > planeD) || (!renderAbove && dotProduct < planeD)) {
                        const index = x + y * volume.width + z * volume.width * volume.height;
                        visibleVoxels.push(volume.voxels[index]);
                    }
                }
            }
        }
        createHistogram(visibleVoxels);
    }
}

function setupCuttingPlaneUI() {
    const xSlider = document.getElementById('planeX');
    const ySlider = document.getElementById('planeY');
    const colorPicker = document.getElementById('planeColor');
    const renderAboveRadio = document.querySelector('input[name="renderSide"][value="above"]');
    const renderBelowRadio = document.querySelector('input[name="renderSide"][value="below"]');

    let colorUpdateTimeout;
    const updateDelay = 50;

    function updateCuttingPlane() {
        if (firstHitShader && firstHitShader.material) {
            const rotationX = parseFloat(xSlider.value) * Math.PI; // Scale to radians if needed
            const rotationY = parseFloat(ySlider.value) * Math.PI; // Scale to radians if needed
            const color = colorPicker.value;
            const renderAbove = renderAboveRadio.checked;

            // Initial normal vector (perpendicular to Z)
            let normal = new THREE.Vector3(0, 0, -1);

            // Apply rotations
            normal.applyAxisAngle(new THREE.Vector3(1, 0, 0), rotationX); // Rotate around X-axis
            normal.applyAxisAngle(new THREE.Vector3(0, 1, 0), rotationY); // Rotate around Y-axis

            normal.normalize(); // Ensure it's a unit vector

            firstHitShader.material.uniforms.uPlane.value.set(
                normal.x,
                normal.y,
                normal.z,
                0 // Offset is 0 for rotation around origin
            );
            firstHitShader.material.uniforms.uPlaneColor.value = new THREE.Color(color);
            firstHitShader.material.uniforms.uRenderAbove.value = renderAbove ? 1.0 : 0.0;


            paint();
            updateHistogramForCuttingPlane();
        }
    }

    function handleColorChange() {
        clearTimeout(colorUpdateTimeout);
        colorUpdateTimeout = setTimeout(updateCuttingPlane, updateDelay);
    }

    xSlider.addEventListener('input', updateCuttingPlane);
    ySlider.addEventListener('input', updateCuttingPlane);
    colorPicker.addEventListener('input', updateCuttingPlane);
    renderAboveRadio.addEventListener('change', updateCuttingPlane);
    renderBelowRadio.addEventListener('change', updateCuttingPlane);

    // Initialize the color uniform in the shader
    if (firstHitShader && firstHitShader.material) {
        firstHitShader.setUniform("uPlaneColor", new THREE.Color("#f50000"));
        firstHitShader.setUniform("uRenderAbove", 1.0);
    }
}


function drawSliderElement(svg, adjWidth, adjHeight, onDragCallback, isLive = false) {
    const classSuffix = isLive ? 'live' : 'saved';

    const line = svg.append("line")
        .attr("x1", adjWidth / 2)
        .attr("x2", adjWidth / 2)
        .attr("y1", 0)
        .attr("y2", adjHeight)
        .attr("class", `${classSuffix}-line`)
        .style("stroke", "white")
        .style("stroke-width", "2px")
        .style("cursor", "pointer");

    if (isLive) {
        line.style("stroke-dasharray", "6,3"); // 👈 dashed line for live slider
    }

    const ball = svg.append("circle")
        .attr("cx", adjWidth / 2)
        .attr("cy", 0)
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
