# ROS SLAM Map Editor
A web-based map editor for quick editing of ROS and ROS2 SLAM maps

## Overview
This repository provides a web-based map editor designed specifically for quick and convenient editing of ROS and ROS2 SLAM maps, such as those created in the popular [`slam_toolbox`](https://github.com/SteveMacenski/slam_toolbox). As the ROS2 ecosystem never had a native tool for this purpose, a significant gap existed in the workflow of many robotics developers and researchers. Instead of command lines or image editors, this is a hassle-free, open-source tool that enables engineers and researchers to fine-tune their SLAM maps right inside a modern browser, as well as create Keep-out zones using a mask-filter overlay.

The map editor can be thought of as a specialized paint tool, allowing users to effortlessly modify and refine their maps with precision. With this tool, users can add, remove, or modify map features, such as walls, obstacles, and other elements (e.g. furniture changes in a building), to create a more accurate and reliable representation of their environment.

## Features
- [x] Completely Browser-based Self-Hosted Solution (superior privacy)
- [x] Responsive Map Editing for Touchscreen Devices and Computers
- [x] Drag and Drop Files Capability
- [x] Uses Font Awesome for sleek UI icons
- [x] Convenient Zoom In, Zoom Out, and Auto-Fit buttons
- [x] Invert and Auto-level options
- [x] Paint or Erase Walls in your PGM Map
- [x] Paint or Erase Keep-out zones in your PGM Map
- [x] Line or Rectangle Tools for Clean Edits
- [x] Live-Preview Overlay for Brushing or Drawing Lines/Rectangles
- [x] Multi-level Undo and Redo capabilities
- [x] Download Separate Map and Keepout Mask (yaml and PGM files)

Future Work:

- [ ] Speed Limit Mask overlay

## Credit and License
This tool is created by Dominick Lee as part of GyroPalm's OmniBot V2 AMR product. By making this tool available to the open-source community, the author demonstrates commitment to the principles of collaboration and knowledge-sharing that are at the heart of the open-source community and ROS2 ecosystem. If you are interested in ROS2 gesture-based robotic control, web-based teleoperation, or would like to support the author's work, please feel free to reach out at dlee(@)gyropalm.com

If you choose to use this tool in your work or research, please refer to the MIT license file provided. Please cite the work as follows:
> Lee, Dominick. (2025). ROS SLAM Map Editor [Computer software]. GyroPalm, LLC. https://github.com/GyroPalm/ROS-SLAM-Map-Editor