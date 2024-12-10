const uploadInput = document.getElementById("upload");
// const snapButton = document.getElementById("snapButton");
const downloadButton = document.getElementById("downloadButton");
const blockSizeInput = document.getElementById("blockSizeInput");
// const toleranceInput = document.getElementById('toleranceInput');
const controls = document.getElementById("controls");
const divisor = document.getElementById("divisor");
const slider = document.getElementById("slider");
const comparison = document.getElementById("comparison");
const startProjectButton = document.getElementById("startProjectButton");
const saveProjectButton = document.getElementById("saveProjectButton");
const openProjectButtons = document.querySelectorAll(".open-project");
const deleteProjectButtons = document.querySelectorAll(".delete-project");
const viewSavedProjectsButton = document.getElementById("viewSavedProjectsButton");
const paletteSizeSelect = document.getElementById("paletteSizeSelect");
const openSketchButton  = document.getElementById("open-sketch")
let originalImage = null;
let originalImageURL = null;
let editedImageURL = null;
let originalBlob = null;
let editedBlob = null;
let projectId = null;
let originalFileName = "";
let estimatedBlockSize = 8;
let estimatedTolerance = 30;

const toggleColorChangeMapButton = document.getElementById(
    "toggleColorChangeMapButton"
);
let isColorChangeMapVisible = false;
let colorChangePositions = [];

function calculateColorChanges(img) {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const width = canvas.width;
    const height = canvas.height;
    const changes = [];

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const index = (y * width + x) * 4;
            if (x > 0) {
                const prevIndex = (y * width + x - 1) * 4;
                if (
                    colorsAreDifferent(
                        data.slice(index, index + 3),
                        data.slice(prevIndex, prevIndex + 3),
                        estimatedTolerance
                    )
                ) {
                    changes.push({ x, y });
                }
            }
            if (y > 0) {
                const prevIndex = ((y - 1) * width + x) * 4;
                if (
                    colorsAreDifferent(
                        data.slice(index, index + 3),
                        data.slice(prevIndex, prevIndex + 3),
                        estimatedTolerance
                    )
                ) {
                    changes.push({ x, y });
                }
            }
        }
    }
    return changes;
}

function drawColorChangeMap(img, changes) {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);

    ctx.fillStyle = "red";
    changes.forEach(({ x, y }) => {
        ctx.fillRect(x, y, 1, 1); // Mark each pixel as red
    });

    const overlay = document.querySelector("#comparison figure");
    overlay.style.backgroundImage = `url(${canvas.toDataURL()})`; // Just update display
}

toggleColorChangeMapButton?.addEventListener("click", async () => {
    const overlay = document.querySelector("#comparison figure");
    if (!isColorChangeMapVisible) {
        // Show the color change map
        const img = new Image();
        img.src = originalImageURL; // Use saved original URL
        img.onload = () => {
            if (!colorChangePositions.length) {
                colorChangePositions = calculateColorChanges(img);
            }
            drawColorChangeMap(img, colorChangePositions);
            toggleColorChangeMapButton.textContent = "Hide Color Change Map";
            isColorChangeMapVisible = true;
        };
    } else {
        // Hide color change map and restore original image
        overlay.style.backgroundImage = `url(${originalImageURL})`;
        toggleColorChangeMapButton.textContent = "Show Color Change Map";
        isColorChangeMapVisible = false;
    }
});

function setupOriginalImage(url, imgElement) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const aspectRatio = img.width / img.height;
            comparison.style.aspectRatio = `${aspectRatio}`;
            imgElement.style.backgroundImage = `url(${url})`;
            originalImageURL = url; // Save the original image URL
            console.log("Original image loaded successfully.");
            resolve();
        };
        img.onerror = () => {
            console.error("Error loading image:", url);
            reject(new Error("Failed to load image"));
        };
        img.src = url; // Start image load
    });
}

function setupSnappedImage(editedImageURL) {
    divisor.style.backgroundImage = `url(${editedImageURL})`;
    const comparisonRect = comparison.getBoundingClientRect();
    divisor.style.backgroundSize = `${comparisonRect.width}px ${comparisonRect.height}px`;
    divisor.style.backgroundRepeat = "no-repeat";
    divisor.style.backgroundPosition = "top left";
    // Show buttons only after snapping
    downloadButton.classList.remove("hidden");
    saveProjectButton.classList.remove("hidden");
    console.log("Snapped image setup complete.");
}

function populateBlockValue(img) {
    const blockSize = estimateBlockSize(img);
    blockSizeInput.value = blockSize;
    console.log("Estimated block size:", blockSize);
    return blockSize;
}

async function deleteProject(click) {
    console.log("delete commencing");
    const deleteProjectButton = click.target;
    const project = deleteProjectButton.closest(".project-card");
    projectID = project.getAttribute("data-id");
    try {
        const response = await fetch(`/projects/${projectID}`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
        });
        if (response.ok) {
            window.location.reload();
        }
    } catch (error) {
        console.error("Error deleting project:", error);
    }
}

uploadInput?.addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Reset data attributes and sketch href (diff endpoint called)
    const editorMain = document.getElementById("editor");
    editorMain.setAttribute("data-project-id", "");
    editorMain.setAttribute("data-original-image", "");
    editorMain.setAttribute("data-block-size", "");
    editorMain.setAttribute("data-palette-size", "");
    openSketchButton.href = "/sketch/new";

    // Reset UI state
    originalFileName = file.name.split(".")[0];
    projectId = null;
    editedImageURL = null;
    isColorChangeMapVisible = false;
    toggleColorChangeMapButton.textContent = "Show Color Change Map";
    colorChangePositions = [];
    divisor.style.backgroundImage = "";
    paletteSizeSelect.value = "";
    downloadButton.classList.add("hidden");
    saveProjectButton.classList.add("hidden");

    // Load new image
    const originalImageURL = URL.createObjectURL(file);
    originalBlob = await fetch(originalImageURL).then((res) => res.blob());
    await setupOriginalImage(originalImageURL, document.querySelector("#comparison figure"));

    const img = new Image();
    img.onload = async () => {
        controls.classList.remove("hidden");
        comparison.classList.remove("hidden");

        // Estimate and update block size
        const blockSize = populateBlockValue(img);
        blockSizeInput.value = blockSize;

        // auto-snap image to grid
        await snapToGrid(blockSize);
        downloadButton.classList.remove("hidden");
        saveProjectButton.classList.remove("hidden");
    };
    img.src = originalImageURL;
});


saveProjectButton?.addEventListener("click", async () => {
    const formData = new FormData();
    formData.append("original_image", new File([originalBlob], "original.png"));
    formData.append("edited_image", new File([editedBlob], "edited.png"));
    formData.append("block_size", blockSizeInput.value);
    formData.append("palette_size", paletteSizeSelect.value);
    if (projectId) formData.append("project_id", projectId);
    try {
        const response = await fetch("/projects", {
            method: "POST",
            body: formData,
        });
        if (!response.ok) {
            throw new Error("Failed to save the project");
        }
        const result = await response.json();
        if (result.project_id) {
            console.log("Project saved successfully:", result);
            projectId = result.project_id; // update ID for later saves
        } else {
            console.error("Invalid response: missing project ID");
        }
    } catch (error) {
        console.error("Error saving the project:", error);
    }
});

blockSizeInput?.addEventListener("input", blockSizeChange);


async function blockSizeChange() {
    const userBlockSize =
        parseInt(blockSizeInput.value, 10) || estimatedBlockSize;
    try {
        await snapToGrid(userBlockSize);
        paletteSizeChange();
        downloadButton.classList.remove("hidden");
        saveProjectButton.classList.remove("hidden");
    } catch (error) {
        console.error("Error during snapping or palette size change:", error);
    }
}

downloadButton?.addEventListener("click", () => {
    if (editedImageURL) {
        const link = document.createElement("a");
        link.href = editedImageURL;
        link.download = `piksul_${originalFileName}.png`;
        link.click();
    }
});
deleteProjectButtons?.forEach((button) =>
    button.addEventListener("click", deleteProject)
);
openProjectButtons?.forEach((button) =>
    button.addEventListener("click", openProject)
);

slider?.addEventListener("input", () => {
    divisor.style.width = slider.value + "%";
});

// Set up editor after open project is clicked in gallery
document.addEventListener("DOMContentLoaded", async () => {
    const editorMain = document.getElementById("editor");
    if (editorMain) {
        projectId = editorMain.dataset.projectId;
        console.log({ projectId });
        const originalImageFilename = editorMain.dataset.originalImage;
        const blockSize = editorMain.dataset.blockSize;
        const paletteSize = editorMain.dataset.paletteSize;
        if (projectId && originalImageFilename) {
            const imagePath = `/gallery/image/${originalImageFilename}`;

            try {
                // Fetch the original image as a blob
                const response = await fetch(imagePath);
                if (!response.ok) {
                    throw new Error("Failed to fetch original image");
                }
                originalBlob = await response.blob(); // Update originalBlob

                // Load the image into the editor
                await setupOriginalImage(
                    imagePath,
                    document.querySelector("#comparison figure")
                );
                controls.classList.remove("hidden");
                comparison.classList.remove("hidden");
                // snapButton.classList.remove("hidden");

                // Populate block size
                blockSizeInput.value = blockSize;
                paletteSizeSelect.value = paletteSize;
                blockSizeChange();
            } catch (error) {
                console.error("Error during editor setup:", error);
            }
        }
    }
});

paletteSizeSelect?.addEventListener("change", paletteSizeChange);

function paletteSizeChange() {
    const paletteSize = parseInt(paletteSizeSelect.value, 10);
    if (isNaN(paletteSize)) {
        // "None" selected, reset to regular snapped image
        if (snappedImageURL) {
            editedImageURL = snappedImageURL;
            setupSnappedImage(editedImageURL);
            console.log("Palette reset to snapped image.");
        } else {
            console.warn("No snapped image to reset to.");
        }
    } else {
        // Quantize palette size
        applyQuantizationToImage(paletteSize);
    }
}

// CALCULATIONS
function estimateBlockSize(img) {
    const tolerance = 30;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const width = canvas.width;
    const height = canvas.height;
    let colorChanges = [];

    function analyzeLine(primaryLimit, secondaryLimit, getIndex) {
        for (let primary = 0; primary < primaryLimit; primary++) {
            let prevColor = [
                data[getIndex(primary, 0)],
                data[getIndex(primary, 0) + 1],
                data[getIndex(primary, 0) + 2],
            ];
            let count = 1;
            for (let secondary = 1; secondary < secondaryLimit; secondary++) {
                const index = getIndex(primary, secondary);
                const currentColor = [
                    data[index],
                    data[index + 1],
                    data[index + 2],
                ];
                if (colorsAreDifferent(prevColor, currentColor, tolerance)) {
                    if (count > 1) colorChanges.push(count);
                    count = 1;
                } else {
                    count++;
                }
                prevColor = currentColor;
            }
        }
    }

    analyzeLine(height, width, (y, x) => (y * width + x) * 4); // Horizontal
    analyzeLine(width, height, (x, y) => (y * width + x) * 4); // Vertical

    console.log(`Total color changes: ${colorChanges.length}`);
    colorChanges.sort((a, b) => a - b);
    const lengthThreshold =
        colorChanges[Math.floor(0.75 * colorChanges.length)];
    const filteredChanges = colorChanges.filter(
        (value) => value <= lengthThreshold
    );

    const frequencyMap = {};
    filteredChanges.forEach((value) => {
        frequencyMap[value] = (frequencyMap[value] || 0) + 1;
    });

    const sortedFrequencies = Object.entries(frequencyMap).sort(
        (a, b) => b[1] - a[1]
    );
    const topCandidates = sortedFrequencies
        .slice(0, 3)
        .map(([value]) => parseInt(value));
    const evaluationScores = topCandidates.map((candidateSize) =>
        evaluateSnapping(img, candidateSize)
    );
    const bestCandidateIndex = evaluationScores.indexOf(
        Math.min(...evaluationScores)
    );
    return topCandidates[bestCandidateIndex];
}

function evaluateSnapping(img, blockSize) {
    console.log(`Evaluating snapping quality for block size: ${blockSize}`);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const width = canvas.width;
    const height = canvas.height;

    let totalDeviation = 0;

    // Loop through each block cell
    for (let y = 0; y < height; y += blockSize) {
        for (let x = 0; x < width; x += blockSize) {
            const centerX = Math.min(x + Math.floor(blockSize / 2), width - 1);
            const centerY = Math.min(y + Math.floor(blockSize / 2), height - 1);
            const index = (centerY * width + centerX) * 4;
            const r = data[index];
            const g = data[index + 1];
            const b = data[index + 2];

            let cellDeviation = 0;
            let cellPixelCount = 0;

            let colorSumR = 0,
                colorSumG = 0,
                colorSumB = 0;
            let colorValues = [];

            // Calculate deviation for each pixel in the block cell from the sampled color
            for (let offsetY = 0; offsetY < blockSize; offsetY++) {
                for (let offsetX = 0; offsetX < blockSize; offsetX++) {
                    const pixelX = x + offsetX;
                    const pixelY = y + offsetY;
                    if (pixelX < width && pixelY < height) {
                        const newIndex = (pixelY * width + pixelX) * 4;
                        const dr = data[newIndex] - r;
                        const dg = data[newIndex + 1] - g;
                        const db = data[newIndex + 2] - b;
                        cellDeviation +=
                            Math.abs(dr) + Math.abs(dg) + Math.abs(db);
                        cellPixelCount++;

                        // Calculate color statistics for weight calculation
                        colorSumR += data[newIndex];
                        colorSumG += data[newIndex + 1];
                        colorSumB += data[newIndex + 2];
                        colorValues.push([
                            data[newIndex],
                            data[newIndex + 1],
                            data[newIndex + 2],
                        ]);
                    }
                }
            }

            // Calculate mean color for the cell
            const meanR = colorSumR / cellPixelCount;
            const meanG = colorSumG / cellPixelCount;
            const meanB = colorSumB / cellPixelCount;

            // Calculate standard deviation (or variance) of colors in the cell
            let colorVariance = 0;
            for (let i = 0; i < colorValues.length; i++) {
                const [rVal, gVal, bVal] = colorValues[i];
                colorVariance +=
                    Math.pow(rVal - meanR, 2) +
                    Math.pow(gVal - meanG, 2) +
                    Math.pow(bVal - meanB, 2);
            }
            colorVariance /= cellPixelCount;

            // Apply a stronger non-linear transformation to create significant differences
            const contrastWeight = 1 + Math.pow(colorVariance, 2);

            // Apply weight to cell deviation
            if (cellPixelCount > 0) {
                cellDeviation /= cellPixelCount;
            }
            totalDeviation += cellDeviation * contrastWeight;
        }
    }

    console.log(
        `Total deviation for block size ${blockSize}: ${totalDeviation}`
    );
    return totalDeviation;
}

function colorsAreDifferent(color1, color2, tolerance) {
    return (
        Math.abs(color1[0] - color2[0]) > tolerance ||
        Math.abs(color1[1] - color2[1]) > tolerance ||
        Math.abs(color1[2] - color2[2]) > tolerance
    );
}

let snappedImageURL = null;

async function snapToGrid(blockSize) {
    console.log("Snapping to Grid with size:", blockSize, "and tolerance: 30");
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();

    // Wrap image loading in a Promise
    await new Promise((resolve, reject) => {
        img.src = originalImageURL; // Always start from the original image
        img.onload = resolve;
        img.onerror = () => {
            console.error("Failed to load the original image for snapping.");
            reject(new Error("Failed to load the original image for snapping."));
        };
    });

    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const width = canvas.width;
    const height = canvas.height;

    for (let y = 0; y < height; y += blockSize) {
        for (let x = 0; x < width; x += blockSize) {
            const centerX = Math.min(x + Math.floor(blockSize / 2), width - 1);
            const centerY = Math.min(y + Math.floor(blockSize / 2), height - 1);
            const index = (centerY * width + centerX) * 4;
            const r = data[index];
            const g = data[index + 1];
            const b = data[index + 2];
            const a = data[index + 3];

            for (let offsetY = 0; offsetY < blockSize; offsetY++) {
                for (let offsetX = 0; offsetX < blockSize; offsetX++) {
                    const pixelX = x + offsetX;
                    const pixelY = y + offsetY;
                    if (pixelX < width && pixelY < height) {
                        const newIndex = (pixelY * width + pixelX) * 4;
                        data[newIndex] = r;
                        data[newIndex + 1] = g;
                        data[newIndex + 2] = b;
                        data[newIndex + 3] = a;
                    }
                }
            }
        }
    }

    ctx.putImageData(imageData, 0, 0);
    snappedImageURL = canvas.toDataURL("image/png"); // Save snapped image URL
    editedImageURL = snappedImageURL; // Start with snapped image for display
    // Update editedBlob after snapping
    editedBlob = await fetch(editedImageURL).then((res) => res.blob());
    setupSnappedImage(editedImageURL);
    console.log("Snapping complete.");
}


function applyQuantizationToImage(paletteSize) {
    if (!snappedImageURL) {
        console.error(
            "Snapped image not available. Please snap the image to the grid first."
        );
        return;
    }
    const img = new Image();
    img.src = snappedImageURL; // Use unaltered snapped image
    img.onload = async () => {
        console.log("Quantization started with snapped image.");
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        console.log(`Canvas dimensions: ${canvas.width}x${canvas.height}`);

        try {
            const rgbQuant = new RgbQuant({ colors: paletteSize });
            console.log("Sampling image data for quantization...");
            rgbQuant.sample(imageData.data);
            const reducedData = rgbQuant.reduce(imageData.data, 2); // Request palette-indexed array
            const palette = rgbQuant.palette(true); // Get palette as RGB triplets

            if (!palette || palette.length === 0) {
                console.error("RgbQuant failed to generate a palette.");
                return;
            }
            const reducedImageData = ctx.createImageData(
                canvas.width,
                canvas.height
            );
            for (let i = 0; i < reducedData.length; i++) {
                const paletteIndex = reducedData[i];
                const offset = i * 4;
                const alpha = imageData.data[offset + 3]; // Preserve alpha

                if (alpha === 0) {
                    reducedImageData.data[offset] = 0;
                    reducedImageData.data[offset + 1] = 0;
                    reducedImageData.data[offset + 2] = 0;
                    reducedImageData.data[offset + 3] = 0; // Fully transparent
                } else if (paletteIndex >= 0 && paletteIndex < palette.length) {
                    const color = palette[paletteIndex];
                    reducedImageData.data[offset] = color[0]; // Red
                    reducedImageData.data[offset + 1] = color[1]; // Green
                    reducedImageData.data[offset + 2] = color[2]; // Blue
                    reducedImageData.data[offset + 3] = 255; // Fully opaque
                } else {
                    reducedImageData.data[offset] =
                        reducedImageData.data[offset + 1] =
                        reducedImageData.data[offset + 2] =
                            0;
                    reducedImageData.data[offset + 3] = 255;
                }
            }

            ctx.putImageData(reducedImageData, 0, 0);
            editedImageURL = canvas.toDataURL("image/png"); // Update the quantized image URL

            // Update editedBlob after quantization
            editedBlob = await fetch(editedImageURL).then((res) => res.blob());
            setupSnappedImage(editedImageURL);
            console.log(`Image quantized to ${paletteSize} colors.`);
        } catch (err) {
            console.error("Error during quantization:", err);
        }
    };

    img.onerror = () =>
        console.error("Failed to load the snapped image for quantization.");
}
