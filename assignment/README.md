## How to Use

Load one of the provided volume files through the GUI. 
Rotate the orbit camera around the bounding box using the left mouse button. Zoom using the scroll wheel. 

### Transfer Function Controls

The transfer function interface allows you to highlight specific intensity and density ranges in the volumetric data using color layers. Here's how to use it:

1. **Select an Intensity & Density:**
  - Move the **dashed white slider** to the desired position on the histogram. This sets the intensity and density for the new layer.

2. **Choose a Surface Color:**
  - Click on the color box to open the color picker, then select your desired color for this layer.

3. **Save the Layer:**
  - Click **"Save layer"** to apply the selected color to the chosen intensity/density range. This will:
    - Create a new active layer (up to 3 total).
    - Lock the current slider — its position cannot be changed afterward.

4. **Managing Layers:**
  - You may only **delete the most recently added layer** by clicking **"Delete layer"**.
  - If you want to modify a previous layer's position or color, you must delete layers until you reach the one you want to change, then re-add them.

---

### Cutting Plane Controls

The cutting plane feature allows you to slice through the volumetric data, revealing internal structures. You can control its behavior using the following options:

- **Render Side:** Choose to display the volume **Above** or **Below** the cutting plane. This determines which part of the data remains visible.
- **Translation:** Use the *"Translation"* slider to move the cutting plane along its normal (perpendicular to its surface), effectively pushing it deeper into or pulling it out of the volume.
- **Rotation X & Y:** Adjust the *"Rotation X"* and *"Rotation Y"* sliders to tilt the cutting plane. These rotations are applied relative to the plane's current orientation, providing intuitive control over its angle.

---

### Ambient Occlusion Controls

SSAO (Screen Space Ambient Occlusion) is a rendering technique that adds subtle shadowing where surfaces are close together, like in corners, cracks, or tight spaces. It helps scenes feel more grounded and three-dimensional.

You can adjust the following parameters:

- **Radius (-2.0 – 2.0):** Controls the sampling distance for ambient occlusion. A larger radius considers occlusion from further away objects, while a smaller radius focuses on local details.
- **Bias (-0.1 – 0.1):** Prevents self-occlusion artifacts. Increase this value if you notice dark spots on surfaces that should be fully lit, decrease it for more pronounced occlusion effects.
- **Strength (-2 – 2):** Determines the intensity of the ambient occlusion effect. Higher values create stronger shadowing in occluded areas, while lower values result in more subtle effects.


## Framework Description

This framework uses three.js and d3.js for volume rendering and setting the appearance, respectively. 
The following files are provided: 
* **index.html**: contains the HTML content. Please enter your names! Otherwise, it does not need to be changed 
(but can be, if required). 
* **style.css**: CSS styles (can be adjusted, but does not need to be changed). 
* **three.js/build/three.js**: Contains the three.js library. **Do not modify!**
* **d3.js/d3.v7.js**: Contains the d3.js library. **Do not modify!**
* **shaders**: Folder containing a dummy vertex and fragment shader. **Add your shaders to this folder!** 
* **js**: Folder containing all JavaScript files. **Add new classes as separate js-files in this folder!** 
    * **vis1.js**: Main script file. Needs to be modified. 
    * **shader.js**: Base shader class. Does not need to be modified. Derive your custom shader materials from this class!
    * **testShader.js**: Example shader class demonstrating how to create and use a shader material 
    using external .essl files. Should not be used in the final submission.
    * **camera.js**: Simple orbit camera that moves nicely around our volumes. Does not need to be modified. 
    * **vis2.js**: Main application script for visualization and UI
    * **firstHitShader.js**: First-hit volume rendering implementation
    * **CuttingPlaneEditor.js**: Cutting plane functionality
    * **singlePassMipShader.js**: Maximum Intensity Projection shader
    
Created 2021 by Manuela Waldner, Diana Schalko, amd Laura Luidolt based on the Vis1 Task 1 Qt framework 
initially created by Johanna Schmidt, Tobias Klein, and Laura Luidolt. Updated 2022 and 2023 by Manuela Waldner. 

## JavaScript

Javascript files should go to folder 'js' and end with '.js'. All new javascript files have to be included in index.html. 

Recommended IDE: Webstorm (free educational version available using TU Wien e-mail address)

*Important*: do not run index.html from the file system! Only execute it from inside WebStorm 
(by selecting a browser icon from the top right panel that appears when you open index.html) 
or from hosting the project within another web server. Opening index.html directly in the browser without a server
will result in an error when trying to load the the .essl shader files. 


## Shaders

.essl is the OpenGL ES shading language. Shader files should all be located in the folder 'shaders' and end with '.essl'.  

Recommended code editor: Visual Studio Code (free): https://code.visualstudio.com/

Install syntax highlighting for shading languages: https://marketplace.visualstudio.com/items?itemName=slevesque.shader

Enable syntax highlighting: open shader file --> in the bar on the bottom right, switch from plain text to GLSL.  