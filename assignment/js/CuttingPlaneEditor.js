/**
 * Global function to show user messages.
 * This is a placeholder; you'd typically implement a UI update here.
 * @param {string} message - The message to display.
 */
function showUserMessage(message) {
    console.warn("User Message:", message);
    // You can implement UI updates here if you have a message display area
}

/**
 * Class to manage the cutting plane UI and interactions.
 * It handles the cutting plane's parameters in the shader and its visual representation.
 */
class CuttingPlaneEditor {
    /**
     * @param {THREE.ShaderMaterial} firstHitShader - The shader material used for volume rendering,
     * which needs the cutting plane uniforms.
     * @param {function} paintCallback - Callback function to trigger a re-render of the scene.
     * @param {function} updateHistogramCallback - Callback function to re-calculate and update the histogram.
     */
    constructor(firstHitShader, paintCallback, updateHistogramCallback) {
        this.firstHitShader = firstHitShader;
        this.paintCallback = paintCallback;
        this.updateHistogramCallback = updateHistogramCallback;
        this.volume = null; // Volume data object, set when loaded

        // Debounce for visual plane updates (less CPU intensive, faster feedback)
        this.planeUpdateTimeout = null;
        this.planeUpdateDelay = 10;

        this.histogramUpdateTimeout = null;
        this.histogramUpdateDelay = 700;

        // UI elements references
        this.xSlider = document.getElementById('planeX');
        this.ySlider = document.getElementById('planeY');
        this.zSlider = document.getElementById('planeTranslate');
        this.colorPicker = document.getElementById('planeColor');
        this.renderAboveRadio = document.querySelector('input[name="renderSide"][value="above"]');
        this.renderBelowRadio = document.querySelector('input[name="renderSide"][value="below"]');
        // NEW: Reference to the toggle checkbox
        this.togglePlaneMeshCheckbox = document.getElementById('togglePlaneMesh');

        this.planeMesh = null;

        // Store the plane's current orientation as a quaternion
        this.planeQuaternion = new THREE.Quaternion();
        // Store the initial orientation of the plane's normal (usually +Z)
        this.initialPlaneNormal = new THREE.Vector3(0, 0, 1); // This is the local Z-axis of the plane mesh

        // Store previous slider values for incremental rotation calculation
        this.prevXValue = 0;
        this.prevYValue = 0;
    }

    /**
     * Sets the volume data for the editor.
     * This is typically called after the volume is loaded.
     * @param {Volume} volume - The volume data object.
     */
    setVolume(volume) {
        this.volume = volume;
        // Only add visualization if the checkbox is initially checked
        if (this.togglePlaneMeshCheckbox && this.togglePlaneMeshCheckbox.checked) {
            this.addCuttingPlaneVisualization(); // Add the plane mesh once volume is set
        }
    }

    /**
     * Initializes the UI elements and attaches event listeners.
     * Must be called after the DOM is loaded and UI elements exist.
     */
    init() {
        // Basic check to ensure all required UI elements are found
        if (!this.xSlider || !this.ySlider || !this.zSlider || !this.colorPicker || !this.renderAboveRadio || !this.renderBelowRadio || !this.togglePlaneMeshCheckbox) {
            console.error("Cutting plane UI elements not found. Make sure their IDs are correct in HTML.");
            showUserMessage("Error: Cutting plane UI elements not found. Check console for details.");
            return;
        }

        // Initialize prev values with current slider values
        this.prevXValue = parseFloat(this.xSlider.value);
        this.prevYValue = parseFloat(this.ySlider.value);

        // Attach event listeners for sliders and other controls.
        this.xSlider.addEventListener('input', () => this.debouncedPlaneUpdate('x'));
        this.ySlider.addEventListener('input', () => this.debouncedPlaneUpdate('y'));
        this.zSlider.addEventListener('input', () => this.debouncedPlaneUpdate('z')); // Z doesn't cause rotation
        this.colorPicker.addEventListener('input', () => this.debouncedPlaneUpdate());
        this.renderAboveRadio.addEventListener('change', () => this.debouncedPlaneUpdate());
        this.renderBelowRadio.addEventListener('change', () => this.debouncedPlaneUpdate());

        // NEW: Event listener for the toggle checkbox
        this.togglePlaneMeshCheckbox.addEventListener('change', () => this.togglePlaneMeshVisibility());

        // Initialize shader uniforms for the cutting plane on setup
        if (this.firstHitShader && this.firstHitShader.material) {
            // Set initial uniform values (e.g., default color, render side)
            this.firstHitShader.setUniform("uPlaneColor", new THREE.Color("#ff0000"));
            this.firstHitShader.setUniform("uRenderAbove", 1.0); // Default to render above

            // Initialize the plane quaternion to an identity (no rotation)
            this.planeQuaternion.identity();

            this.updatePlane(); // Perform an initial update to set the plane
        } else {
            console.error("firstHitShader or its material is not available for initial setup.");
            showUserMessage("Error: Shader not ready for cutting plane setup.");
        }
    }

    /**
     * Debounces calls to `updatePlane` to prevent excessive rendering.
     * This method also triggers the debounced histogram update.
     * @param {string} changedAxis - 'x', 'y', or 'z' if a slider was moved, otherwise null.
     */
    debouncedPlaneUpdate(changedAxis = null) {
        clearTimeout(this.planeUpdateTimeout);
        this.planeUpdateTimeout = setTimeout(() => {
            this.updatePlane(changedAxis);
        }, this.planeUpdateDelay);
        // Always trigger histogram update debounce whenever plane parameters change
        this.debouncedHistogramUpdate();
    }

    /**
     * Debounces calls to `updateHistogramCallback` to prevent excessive CPU usage.
     */
    debouncedHistogramUpdate() {
        clearTimeout(this.histogramUpdateTimeout);
        this.histogramUpdateTimeout = setTimeout(() => {
            this.updateHistogramCallback();
        }, this.histogramUpdateDelay);
    }

    /**
     * Toggles the visibility of the planeMesh.
     * This is called when the 'Show Plane Visualization' checkbox changes.
     */
    togglePlaneMeshVisibility() {
        if (!this.planeMesh) {
            // If plane mesh doesn't exist, try to add it if checkbox is checked
            if (this.togglePlaneMeshCheckbox.checked) {
                this.addCuttingPlaneVisualization();
            }
            // If it still doesn't exist (e.g., volume not loaded), nothing more to do
            return;
        }

        this.planeMesh.visible = this.togglePlaneMeshCheckbox.checked;
        this.paintCallback(); // Re-render the scene to reflect the change
    }


    /**
     * Updates the cutting plane's parameters in the shader uniforms and its visual mesh.
     * @param {string} changedAxis - 'x', 'y', or 'z' if a slider was moved, otherwise null.
     */
    updatePlane(changedAxis = null) {
        if (!this.firstHitShader || !this.firstHitShader.material) {
            return;
        }

        const currentX = parseFloat(this.xSlider.value);
        const currentY = parseFloat(this.ySlider.value);
        const translationSliderValue = parseFloat(this.zSlider.value); // Renamed for clarity
        const color = this.colorPicker.value;
        const renderAbove = this.renderAboveRadio.checked;

        // Calculate incremental rotation based on the changed slider
        if (changedAxis === 'x' && currentX !== this.prevXValue) {
            const deltaX = (currentX - this.prevXValue) * Math.PI; // Convert delta to radians
            // Rotate around the plane's *current local X-axis*.
            // To get the world-space local X-axis, transform (1,0,0) by current quaternion.
            const localXAxis = new THREE.Vector3(1, 0, 0).applyQuaternion(this.planeQuaternion).normalize();
            const rotationQuaternion = new THREE.Quaternion().setFromAxisAngle(localXAxis, deltaX);
            this.planeQuaternion.multiplyQuaternions(rotationQuaternion, this.planeQuaternion); // Apply new rotation
            this.planeQuaternion.normalize();
        } else if (changedAxis === 'y' && currentY !== this.prevYValue) {
            const deltaY = (currentY - this.prevYValue) * Math.PI; // Convert delta to radians
            // Rotate around the plane's *current local Y-axis*.
            const localYAxis = new THREE.Vector3(0, 1, 0).applyQuaternion(this.planeQuaternion).normalize();
            const rotationQuaternion = new THREE.Quaternion().setFromAxisAngle(localYAxis, deltaY);
            this.planeQuaternion.multiplyQuaternions(rotationQuaternion, this.planeQuaternion);
            this.planeQuaternion.normalize();
        }

        // Update previous slider values
        this.prevXValue = currentX;
        this.prevYValue = currentY;

        // Get the current normal vector from the plane's accumulated quaternion
        // The plane's normal is its local Z-axis transformed by its world rotation.
        const currentNormal = this.initialPlaneNormal.clone().applyQuaternion(this.planeQuaternion);
        currentNormal.normalize(); // Ensure it's a unit vector


        // The 'D' constant in the plane equation (Ax + By + Cz + D = 0).
        // It is the negative of the signed distance from the origin to the plane.
        const planeConstantInShader = -translationSliderValue;

        // Update the shader uniforms
        if (this.firstHitShader.material.uniforms.uPlane) {
            this.firstHitShader.material.uniforms.uPlane.value.set(
                currentNormal.x,
                currentNormal.y,
                currentNormal.z,
                planeConstantInShader // This is D
            );
        }
        if (this.firstHitShader.material.uniforms.uPlaneColor) {
            this.firstHitShader.material.uniforms.uPlaneColor.value = new THREE.Color(color);
        }
        if (this.firstHitShader.material.uniforms.uRenderAbove) {
            this.firstHitShader.material.uniforms.uRenderAbove.value = renderAbove ? 1.0 : 0.0;
        }

        // Update the visual representation of the plane mesh
        if (this.planeMesh) {
            // Only update position/color if visible, otherwise, it won't be drawn anyway.
            // But it's good practice to keep its internal state updated.
            this.planeMesh.position.copy(currentNormal).multiplyScalar(planeConstantInShader);

            // Apply the stored quaternion to the plane mesh for its orientation
            this.planeMesh.setRotationFromQuaternion(this.planeQuaternion);

            // Update the color of the visual plane mesh
            this.planeMesh.material.color.set(color);

            // Ensure its visibility matches the checkbox state
            this.planeMesh.visible = this.togglePlaneMeshCheckbox.checked;
        }

        // Trigger the scene re-render
        this.paintCallback();
    }

    /**
     * Adds a visual representation of the cutting plane to the Three.js scene.
     * This plane helps users understand the orientation and position of the cut.
     */
    addCuttingPlaneVisualization() {
        // Ensure 'scene' (your Three.js scene) and 'this.volume' are available
        if (typeof scene === 'undefined' || !this.volume) {
            console.warn("THREE.js scene or volume not ready for cutting plane visualization. Skipping.");
            return;
        }

        // If a plane mesh already exists, remove it and dispose of its resources
        if (this.planeMesh) {
            scene.remove(this.planeMesh);
            this.planeMesh.geometry.dispose();
            this.planeMesh.material.dispose();
            this.planeMesh = null;
        }

        // Determine an appropriate size for the visual plane based on volume dimensions
        const maxDim = Math.max(this.volume.width, this.volume.height, this.volume.depth);
        const planeSize = maxDim * 1.5; // Make it a bit larger than the volume for visibility

        // Create the geometry and material for the plane mesh
        const planeGeometry = new THREE.PlaneGeometry(planeSize, planeSize);
        const planeMaterial = new THREE.MeshBasicMaterial({
            color: new THREE.Color(this.colorPicker.value), // Use the current color from the UI
            side: THREE.DoubleSide, // Render from both sides
            transparent: false, // Make it solid for now
            depthWrite: true, // Ensure it writes to the depth buffer for correct rendering
        });

        // Create the mesh and add it to the scene
        this.planeMesh = new THREE.Mesh(planeGeometry, planeMaterial);
        this.planeMesh.renderOrder = 1; // Render after the volume for correct transparency/depth sorting
        scene.add(this.planeMesh);

        // Set initial visibility based on checkbox state
        this.planeMesh.visible = this.togglePlaneMeshCheckbox.checked;

        // Perform an initial update to position and orient the newly added plane mesh
        this.updatePlane();
    }
}