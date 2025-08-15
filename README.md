# ROS SLAM Map Editor
A web-based map editor for quick editing of ROS and ROS2 SLAM maps

## Overview
This repository provides a web-based map editor designed specifically for quick and convenient editing of ROS and ROS2 SLAM maps, such as those created in the popular [`slam_toolbox`](https://github.com/SteveMacenski/slam_toolbox). As the ROS2 ecosystem never had a native tool for this purpose, a significant gap existed in the workflow of many robotics developers and researchers. Instead of command lines or image editors, this is a hassle-free, open-source tool that enables engineers and researchers to fine-tune their SLAM maps right inside a modern browser, as well as create Keep-out zones using a mask-filter overlay.

The map editor can be thought of as a specialized paint tool, allowing users to effortlessly modify and refine their maps with precision. With this tool, users can add, remove, or modify map features, such as walls, obstacles, and other elements (e.g. furniture changes in a building), to create a more accurate and reliable representation of their environment. This tool helps users achieve what would normally take longer with a 3rd party image editor.

![Screenshot](img/screenshot-main.png)

## Features
- [x] Completely Browser-based Self-Hosted Solution (superior privacy)
- [x] Responsive Map Editing for Touchscreen Devices and Computers
- [x] Drag and Drop Map PGM and YAML files
- [x] Drag and Drop Keepout PGM and YAML files (suffix as `_keepout.pgm` and `_keepout.yaml`)
- [x] Drag and Drop to Load Both File Sets
- [x] Uses Font Awesome for sleek UI icons
- [x] Convenient Zoom In, Zoom Out, and Auto-Fit buttons
- [x] Invert and Auto-level options
- [x] Paint or Erase Walls in your PGM Map
- [x] Paint or Erase Keep-out zones in your PGM Map
- [x] Un-Scan Area (Mark area as unknown)
- [x] Line or Rectangle Tools for Clean Edits
- [x] Live-Preview Overlay for Brushing or Drawing Lines/Rectangles
- [x] Multi-level Undo and Redo Capabilities (with `CTRL+Z` and `CTRL+Y` hotkeys)
- [x] Option to Draw Filled Rectangles
- [x] (Hold `Spacebar` + Drag Mouse) to Pan the Map
- [x] (Hold `Shift` + Scroll) to Zoom to Cursor
- [x] Drag to Take Measurements Dynamically from a Map
- [x] Download Separate Map and Keepout Mask (yaml and PGM files)

Future Work:

- [ ] Speed Limit Mask overlay
- [ ] Polygon Tool
- [ ] Grid in Meters

## Usage
You can use this tool for free by visiting: [https://gyropalm.github.io/ROS-SLAM-Map-Editor/editor.html](https://gyropalm.github.io/ROS-SLAM-Map-Editor/editor.html)

*Demo SLAM maps are included in the `maps` folder.*

1. Select both your `map.yaml` and `map.pgm` files. Drag and drop them in the top-left designated box.
2. Once loaded, you should see the "YAML preview" and Debug info. You can Zoom In or Zoom Out using the bottoms on the top toolbar. You can also zoom by holding `Shift` and scrolling up.
3. Click the `Wall` button to start painting a wall at your desired area. Change the Brush size by using the slider on the right. (Zooming in will not change your brush size)
4. You can also use the "Line" or "Rectangle" mode to draw cleaner walls or keep-out zones. To draw a solid-filled rectangle, checkmark the `Filled` option.
5. Select the `Erase` button to erase a wall. If you wish to mark an area as unknown, select the `Un-Scan` button.
6. To draw a Keep-Out zone, click the `Keep-Out` button, then choose between "Freehand", "Line", or "Rectangle" mode.
7. To measure distance of one point to another, select the "Measure Distance" mode (icon with dual arrows). Then click on point A and drag your mouse to point B to see the dimension. Both meters and feet are provided for convenience.
8. Once editing is completed, click the `Download Map` button and you will be prompted to save your updated `map_edited.yaml` and `map_edited.pgm` files respectively. Do the same for Keep-Out zones by clicking `Download Keepout Mask`.

## Credit and License
This tool is created by Dominick Lee as part of GyroPalm's OmniBot V2 AMR product. By making this tool available to the open-source community, the author demonstrates commitment to the principles of collaboration and innovation that are at the heart of the open-source community and ROS2 ecosystem. If you are interested in ROS2 gesture-based robotic control, collaboration based on ROS2 robots, have a commercial use-case, or would like to support the author's work, please feel free to reach out at dlee(@)gyropalm.com

If you choose to use this tool in your work or research, please refer to the MIT license file provided. Please cite the work as follows:
> Lee, Dominick. (2025). ROS SLAM Map Editor [Computer software]. GyroPalm, LLC. https://github.com/GyroPalm/ROS-SLAM-Map-Editor