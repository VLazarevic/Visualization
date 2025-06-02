/**
 * Global function to show user messages.
 * This is a placeholder; you'd typically implement a UI update here.
 * @param {string} message - The message to display.
 */
function showUserMessage(message) {
    console.warn("User Message:", message);
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
        this.volume = null;

        this.planeUpdateTimeout = null;
        this.planeUpdateDelay = 10;

        this.histogramUpdateTimeout = null;
        this.histogramUpdateDelay = 600;

        this.xSlider = document.getElementById('planeX');
        this.ySlider = document.getElementById('planeY');
        this.zSlider = document.getElementById('planeTranslate');
        this.renderAboveRadio = document.querySelector('input[name="renderSide"][value="above"]');
        this.renderBelowRadio = document.querySelector('input[name="renderSide"][value="below"]');


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
    }

    /**
     * Initializes the UI elements and attaches event listeners.
     * Must be called after the DOM is loaded and UI elements exist.
     */
    init() {
        if (!this.xSlider || !this.ySlider || !this.zSlider || !this.renderAboveRadio || !this.renderBelowRadio) {
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
        this.renderAboveRadio.addEventListener('change', () => this.debouncedPlaneUpdate());
        this.renderBelowRadio.addEventListener('change', () => this.debouncedPlaneUpdate());


        // Initialize shader uniforms for the cutting plane on setup
        if (this.firstHitShader && this.firstHitShader.material) {
            this.firstHitShader.setUniform("uRenderAbove", 1.0); // Default to render above

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
     * Updates the cutting plane's parameters in the shader uniforms and its visual mesh.
     * @param {string} changedAxis - 'x', 'y', or 'z' if a slider was moved, otherwise null.
     */
    updatePlane(changedAxis = null) {
        if (!this.firstHitShader || !this.firstHitShader.material) {
            return;
        }

        const currentX = parseFloat(this.xSlider.value);
        const currentY = parseFloat(this.ySlider.value);
        const translationSliderValue = parseFloat(this.zSlider.value);
        const renderAbove = this.renderAboveRadio.checked;

        // Calculate incremental rotation based on the changed slider
        if (changedAxis === 'x' && currentX !== this.prevXValue) {
            const deltaX = (currentX - this.prevXValue) * Math.PI; // Convert delta to radians
            const localXAxis = new THREE.Vector3(1, 0, 0).applyQuaternion(this.planeQuaternion).normalize();
            const rotationQuaternion = new THREE.Quaternion().setFromAxisAngle(localXAxis, deltaX);
            this.planeQuaternion.multiplyQuaternions(rotationQuaternion, this.planeQuaternion); // Apply new rotation
            this.planeQuaternion.normalize();
        } else if (changedAxis === 'y' && currentY !== this.prevYValue) {
            const deltaY = (currentY - this.prevYValue) * Math.PI; // Convert delta to radians
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
        if (this.firstHitShader.material.uniforms.uRenderAbove) {
            this.firstHitShader.material.uniforms.uRenderAbove.value = renderAbove ? 1.0 : 0.0;
        }

        // Trigger the scene re-render
        this.paintCallback();
    }

}