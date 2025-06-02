class FirstHitShader extends Shader {
    constructor() {
        super("first_hit_vert", "first_hit_frag");
        this.setSteps(200);

        // Initialize cutting plane uniforms
        this.setUniform("uPlane", new THREE.Vector4(0, 0, -1, 0));
        this.setUniform("uRenderAbove", 1.0);
    }

    /**
     * Creates a 3D texture from the given volume and sets the corresponding uniforms.
     *
     * @param {Volume} volume - The volume data to render.
     */
    setVolume(volume) {
        const texture = new THREE.Data3DTexture(volume.voxels, volume.width, volume.height, volume.depth);
        texture.format = THREE.RedFormat;
        texture.type = THREE.FloatType;
        texture.minFilter = texture.magFilter = THREE.LinearFilter;
        texture.unpackAlignment = 1;
        texture.needsUpdate = true;


        this.setUniform("volume", texture);
        this.setUniform("volume_scale", volume.scale);
    }

    /**
     * Sets the number of sampling steps along each ray.
     *
     * @param {number} steps - Must be greater than 1.
     */
    setSteps(steps) {
        this.setUniform("steps", steps);
    }

    /**
     * Updates the iso-surface thresholds.
     *
     * @param {number[]} isoValues - Array of iso values.
     */
    setIsoValues(isoValues) {
        this.setUniform("iso_values", isoValues);
    }

    /**
     * Sets opacity values for each iso-surface.
     *
     * @param {number[]} opacities - Array of opacities per iso value.
     */
    setOpacities(opacities) {
        this.setUniform("opacities", opacities);
    }

    /**
     * Sets surface colors for each iso-surface.
     *
     * @param {THREE.Vector3[]} colors - RGB colors (vec3) for each iso value.
     */
    setSurfaceColors(colors){
        this.setUniform("surface_colors", colors, "v3v");
    }
}