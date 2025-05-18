class SinglePassMipShader extends Shader {
    constructor() {
        super("single_pass_mip_vert", "single_pass_mip_frag");
        this.setUniform("uEyeOs", new THREE.Vector3());
        this.setUniform("uPlane", new THREE.Vector4(0, 0, -1, 0)); // Example: slice along Z
        this.setUniform("uPlaneColor", new THREE.Color("#ffffff"));
        this.setUniform("uRenderAbove", 1.0);

    }

    setVolume(volume) {
        const tex = new THREE.Data3DTexture(
            volume.voxels,
            volume.width,
            volume.height,
            volume.depth
        );
        tex.format = THREE.RedFormat;
        tex.type = THREE.FloatType;
        tex.minFilter = tex.magFilter = THREE.LinearFilter;
        tex.unpackAlignment = 1;
        tex.needsUpdate = true;

        this.setUniform("volume", tex);
        this.setUniform("uVolumeDims", new THREE.Vector3(volume.width, volume.height, volume.depth));
    }

    setSteps(steps) {
        this.setUniform("steps", steps);
    }

}