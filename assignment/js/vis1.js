/**
 * Vis 1 Task 1 Framework
 * Copyright (C) TU Wien
 *   Institute of Visual Computing and Human-Centered Technology
 *   Research Unit of Computer Graphics
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are not permitted.
 *
 * Main script for Vis1 exercise. Loads the volume, initializes the scene, and contains the paint function.
 *
 * @author Manuela Waldner
 * @author Laura Luidolt
 * @author Diana Schalko
 */
let renderer, camera, scene, orbitCamera;
let canvasWidth, canvasHeight = 0;
let container = null;
let volume = null;
let fileInput = null;
//let testShader = null;
let singlePassMipShader = null;

/**
 * Load all data and initialize UI here.
 */
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

    // dummy shader gets a color as input
    //testShader = new TestShader([255.0, 255.0, 0.0]);
    singlePassMipShader = new SinglePassMipShader();
}

/**
 * Handles the file reader. No need to change anything here.
 */
function readFile(){
    let reader = new FileReader();
    reader.onloadend = function () {
        console.log("data loaded: ");

        let data = new Uint16Array(reader.result);
        volume = new Volume(data);

        createHistogram(Volume.voxels);

        singlePassMipShader.setVolume(volume);
        singlePassMipShader.setSteps(200);

        resetVis();
    };
    reader.readAsArrayBuffer(fileInput.files[0]);
}

/**
 * Construct the THREE.js scene and update histogram when a new volume is loaded by the user.
 *
 * Currently renders the bounding box of the volume.
 */
async function resetVis(){
    // create new empty scene and perspective camera
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera( 75, canvasWidth / canvasHeight, 0.1, 1000 );

    const box = new THREE.BoxGeometry(volume.width, volume.height, volume.depth);
    const material = singlePassMipShader.material;
    await singlePassMipShader.load(); // this function needs to be called explicitly, and only works within an async function!
    const mesh = new THREE.Mesh(box, material);
    scene.add(mesh);

    // our camera orbits around an object centered at (0,0,0)
    orbitCamera = new OrbitCamera(camera, new THREE.Vector3(0,0,0), 2*volume.max, renderer.domElement);

    // init paint loop
    requestAnimationFrame(paint);
}

/**
 * Render the scene and update all necessary shader information.
 */
function paint(){
    if (volume) {
        const mesh = scene.children.find(obj => obj instanceof THREE.Mesh);
        const material = mesh.material;

        const invModel = new THREE.Matrix4().copy(mesh.matrixWorld).invert();
        const eyeOs = camera.position.clone().applyMatrix4(invModel);
        eyeOs.divide(new THREE.Vector3(volume.width, volume.height, volume.depth));

        // Update uniform
        material.uniforms.uEyeOs.value.copy(eyeOs);

        renderer.render(scene, camera);
    }
}

function createHistogram(voxels) {
    const container = d3.select("#tfContainer");
    const width = 500;
    const height = width / 2;
    const margin = { top: 10, right: 30, bottom: 40, left: 40 };
    const adjWidth = width - margin.left - margin.right;
    const adjHeight = height - margin.top - margin.bottom;

    let intensity = 0;
    let density = 0;

    // Create or select SVG
    let svg = container.select('svg');
    if (svg.empty()) {
        svg = container.append('svg')
            .attr('width', '100%')
            .attr('height', '100%')
            .append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        svg.append('g').attr('class', 'x-axis').attr('transform', `translate(0,${adjHeight})`);
        svg.append('g').attr('class', 'y-axis');

        // Create draggable line and ball
        const line = svg.append("line")
            .attr("x1", adjWidth / 2).attr("x2", adjWidth / 2)
            .attr("y1", 0).attr("y2", adjHeight)
            .style("stroke", "#ffffff").style("stroke-width", "2px").style("cursor", "pointer");

        const ball = svg.append("circle")
            .attr("cx", adjWidth / 2).attr("cy", 0).attr("r", 10)
            .style("fill", "#ffffff").style("cursor", "pointer");

        const drag = d3.drag().on("drag", function (event) {
            const newX = Math.max(0, Math.min(adjWidth, event.x));
            const newY = Math.max(0, Math.min(adjHeight, event.y));

            line.attr("x1", newX).attr("x2", newX).attr("y1", newY).attr("y2", adjHeight);
            ball.attr("cx", newX).attr("cy", newY);

            density = newX / adjWidth;
            intensity = 1 - newY / adjHeight;
        });

        line.call(drag);
        ball.call(drag);
    }

    // Scales
    const xScale = d3.scaleLinear().domain([0, 1]).range([0, adjWidth]);
    const yScale = d3.scaleLinear().domain([0, 1]).range([adjHeight, 0]);

    const histogram = d3.histogram()
        .value(d => d)
        .domain(xScale.domain())
        .thresholds(xScale.ticks(100));

    const bins = histogram(voxels);
    const yScaleDown = d3.scalePow()
        .exponent(0.25)
        .domain([0, d3.max(bins, d => d.length) * 1.5])
        .range([0, adjHeight]);

    // Axes
    svg.select('.x-axis').call(d3.axisBottom(xScale));
    svg.select('.y-axis').call(d3.axisLeft(yScale));

    // Axis labels (once only)
    if (svg.selectAll('.x-axis-label').empty()) {
        svg.select('.x-axis').append('text')
            .attr('class', 'x-axis-label')
            .attr('x', adjWidth).attr('y', 40)
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
        .attr('y', adjHeight)
        .attr('width', d => Math.max(0, xScale(d.x1) - xScale(d.x0) - 1))
        .attr('height', 0)
        .style('fill', 'white')
        .merge(bars)
        .transition().duration(750)
        .attr('y', d => adjHeight - yScaleDown(d.length))
        .attr('height', d => yScaleDown(d.length))
        .style('opacity', 0.4);

    bars.exit().transition().duration(750)
        .attr('y', adjHeight).attr('height', 0)
        .remove();
}

