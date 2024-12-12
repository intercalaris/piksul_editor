const uploadInput = document.getElementById("upload");
const downloadButton = document.getElementById("downloadButton");
const blockSizeInput = document.getElementById("blockSizeInput");
const controls = document.getElementById("controls");
const outputOptions = document.getElementById("output-options");
const divisor = document.getElementById("divisor");
const slider = document.getElementById("slider");
const comparison = document.getElementById("comparison");
const startProjectButton = document.getElementById("startProjectButton");
const saveProjectButton = document.getElementById("save-project");
const deleteProjectButtons = document.querySelectorAll(".delete-project");
const viewSavedProjectsButton = document.getElementById("viewSavedProjectsButton");
const paletteSizeSelect = document.getElementById("paletteSizeSelect");
const openSketchButton = document.getElementById("open-sketch")

let originalImage = null;
let originalImageURL = null;
let editedImageURL = null;
let originalBlob = null;
let editedBlob = null;
let projectId = null;
let originalFileName = "";
let estimatedBlockSize = 8;
let estimatedTolerance = 30;
const toggleColorChangeMapButton = document.getElementById("toggleColorChangeMapButton");
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
        ctx.fillRect(x, y, 1, 1); // mark color change red
    });

    const overlay = document.querySelector("#comparison figure");
    overlay.style.backgroundImage = `url(${canvas.toDataURL()})`;
}

toggleColorChangeMapButton?.addEventListener("click", async () => {
    const overlay = document.querySelector("#comparison figure");
    if (!isColorChangeMapVisible) {
        const img = new Image();
        img.src = originalImageURL;
        img.onload = () => {
            if (!colorChangePositions.length) {
                colorChangePositions = calculateColorChanges(img);
            }
            drawColorChangeMap(img, colorChangePositions);
            toggleColorChangeMapButton.textContent = "Hide Color Change Map";
            isColorChangeMapVisible = true;
        };
    } else {
        overlay.style.backgroundImage = `url(${originalImageURL})`;
        toggleColorChangeMapButton.textContent = "Show Color Change Map";
        isColorChangeMapVisible = false;
    }
});

window.addEventListener('resize', () => {
    const editorMain = document.getElementById("editor");
    if (editorMain) {
        setupSnappedImage(editedImageURL);
        console.log('resize');
    }
});

function setupOriginalImage(url, imgElement) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const aspectRatio = img.width / img.height;
            comparison.style.aspectRatio = `${aspectRatio}`;
            imgElement.style.backgroundImage = `url(${url})`;
            originalImageURL = url;
            resolve();
        };
        img.onerror = () => {
            console.error("Error loading image:", url);
            reject(new Error("Failed to load image"));
        };
        img.src = url; // start image load
    });
}

function setupSnappedImage(editedImageURL) {
    divisor.style.backgroundImage = `url(${editedImageURL})`;
    const comparisonRect = comparison.getBoundingClientRect();
    divisor.style.backgroundSize = `${comparisonRect.width}px ${comparisonRect.height}px`;
    divisor.style.backgroundRepeat = "no-repeat";
    divisor.style.backgroundPosition = "top left";
    downloadButton.classList.remove("hidden");
    saveProjectButton.classList.remove("hidden");
    toggleColorChangeMapButton.classList.remove("hidden")
}

function populateBlockValue(img) {
    const blockSize = estimateBlockSize(img);
    blockSizeInput.value = blockSize;
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
    openSketchButton.classList.remove("hidden");
    const getStartedText = document.getElementById("get-started");
    getStartedText.style.display = "none";
    // reset data attributes
    const editorMain = document.getElementById("editor");
    editorMain.setAttribute("data-project-id", "");
    editorMain.setAttribute("data-original-image", "");
    editorMain.setAttribute("data-block-size", "");
    editorMain.setAttribute("data-palette-size", "");

    // reset UI
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

    // load new image as object url
    const objectURL = URL.createObjectURL(file);
    originalBlob = await fetch(objectURL).then((res) => res.blob());
    await setupOriginalImage(objectURL, document.querySelector("#comparison figure"));

    // convert to data url
    const dataURL = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });

    // store data url in local storage
    localStorage.setItem("editedImage", dataURL);
    console.log('LocalStorage updated with edited image after upload');

    const img = new Image();
    img.onload = async () => {
        controls.classList.remove("hidden");
        outputOptions.classList.remove("hidden");
        comparison.classList.remove("hidden");

        // estimate and update block size
        const blockSize = populateBlockValue(img);
        blockSizeInput.value = blockSize;
        localStorage.setItem("blockSize", blockSize);
        console.log(`LocalStorage updated with block size: ${blockSizeInput.value} after upload`);

        // auto-snap image to grid
        await snapToGrid(blockSize);
        downloadButton.classList.remove("hidden");
        saveProjectButton.classList.remove("hidden");
        openSketchButton.classList.remove("hidden");
    };

    img.src = objectURL;
});

// Open sketch from sketch ID button in editor
openSketchButton?.addEventListener("click", () => {
    if (openSketchButton.getAttribute("href") === "#") {
        window.location.href = "/sketch/new";
    }
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
            projectId = result.project_id; // update id for later saves
        } else {
            console.error("Invalid response: missing project ID");
        }
    } catch (error) {
        console.error("Error saving the project:", error);
    }
});

blockSizeInput?.addEventListener("input", blockSizeChange);


async function blockSizeChange() {
    const userBlockSize = parseInt(blockSizeInput.value, 10) || estimatedBlockSize;
    try {
        await snapToGrid(userBlockSize);
        paletteSizeChange();
        downloadButton.classList.remove("hidden");
        saveProjectButton.classList.remove("hidden");
        localStorage.setItem("blockSize", userBlockSize);
        console.log(`LocalStorage updated with new block size: ${userBlockSize}`);
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

slider?.addEventListener("input", () => {
    divisor.style.width = slider.value + "%";
});

document.addEventListener("DOMContentLoaded", async () => {
    // Set up editor after open project is clicked in gallery
    const editorMain = document.getElementById("editor");
    const gallery = document.getElementById("gallery");
    if (editorMain) {
        projectId = editorMain.dataset.projectId;
        console.log({ projectId });
        const originalImageFilename = editorMain.dataset.originalImage;
        const blockSize = editorMain.dataset.blockSize;
        const paletteSize = editorMain.dataset.paletteSize;
        
        if (projectId && originalImageFilename) {
            const imagePath = `/gallery/image/${originalImageFilename}`;
            const getStartedText = document.getElementById("get-started");
            getStartedText.style.display = "none";
            openSketchButton.classList.remove("hidden");
            try {
                // fetch original image as blob
                const response = await fetch(imagePath);
                if (!response.ok) {
                    throw new Error("Failed to fetch original image");
                }
                originalBlob = await response.blob();

                // load image into the editor
                await setupOriginalImage(imagePath, document.querySelector("#comparison figure"));
                controls.classList.remove("hidden");
                outputOptions.classList.remove("hidden");
                comparison.classList.remove("hidden");

                // populate block size
                blockSizeInput.value = blockSize;
                paletteSizeSelect.value = paletteSize;
                localStorage.setItem("editedImage", imagePath);
                localStorage.setItem("blockSize", blockSize);
                localStorage.setItem("paletteSize", paletteSize);
                console.log(`LocalStorage initialized from gallery project." Block size: ${blockSizeInput.value}, Palette Size ${paletteSizeSelect.value}`);
                blockSizeChange();
            } catch (error) {
                console.error("Error during editor setup:", error);
            }
        }
    }
    if(gallery) {
        const openSketchButtons = document.querySelectorAll('.project-buttons .open-sketch');          
        openSketchButtons.forEach(button => {
            button.addEventListener('click', (e) => {        
            const projectCard = button.closest('.project-card');
            if (!projectCard) return;
            const projectId = projectCard.dataset.id;
            const blockSize = projectCard.dataset.blockSize;
            const paletteSize = projectCard.dataset.paletteSize;
            const editedImage = projectCard.dataset.editedImage;
            const imagePath = `/gallery/image/${editedImage}`;
            localStorage.setItem("editedImage", imagePath);
            localStorage.setItem("blockSize", blockSize);
            localStorage.setItem("paletteSize", paletteSize);
            window.location.href = `/sketch/${projectId}`;
            });
        });
    }
});

paletteSizeSelect?.addEventListener("change", paletteSizeChange);

function paletteSizeChange() {
    const paletteSize = parseInt(paletteSizeSelect.value, 10);
    localStorage.setItem("paletteSize", paletteSize);
    console.log(`LocalStorage updated with palette size: ${paletteSize}`);
    if (isNaN(paletteSize)) {
        // if none selected, reset to regular snapped image
        if (snappedImageURL) {
            editedImageURL = snappedImageURL;
            setupSnappedImage(editedImageURL);
            localStorage.setItem("editedImage", editedImageURL);
            console.log(`LocalStorage updated with edited image (no quantization)`);
        } else {
            console.warn("No snapped image to reset to.");
        }
    } else {
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

    analyzeLine(height, width, (y, x) => (y * width + x) * 4); // horizontal
    analyzeLine(width, height, (x, y) => (y * width + x) * 4); // vertical
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

    // loop through each block cell
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

            // calculate deviation for each pixel in block cell from sampled color
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

            // calculate mean color for cell
            const meanR = colorSumR / cellPixelCount;
            const meanG = colorSumG / cellPixelCount;
            const meanB = colorSumB / cellPixelCount;

            // calculate variance of colors in cell
            let colorVariance = 0;
            for (let i = 0; i < colorValues.length; i++) {
                const [rVal, gVal, bVal] = colorValues[i];
                colorVariance +=
                    Math.pow(rVal - meanR, 2) +
                    Math.pow(gVal - meanG, 2) +
                    Math.pow(bVal - meanB, 2);
            }
            colorVariance /= cellPixelCount;
            const contrastWeight = 1 + Math.pow(colorVariance, 2);

            // apply weight to cell deviation
            if (cellPixelCount > 0) {
                cellDeviation /= cellPixelCount;
            }
            totalDeviation += cellDeviation * contrastWeight;
        }
    }
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

    await new Promise((resolve, reject) => {
        img.src = originalImageURL; // start from original image
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
    snappedImageURL = canvas.toDataURL("image/png"); 
    editedImageURL = snappedImageURL; 
    editedBlob = await fetch(editedImageURL).then((res) => res.blob());
    setupSnappedImage(editedImageURL);

    // store snapped image as data url
    localStorage.setItem("editedImage", editedImageURL);
    console.log('LocalStorage updated with edited image after snapping');
}

function applyQuantizationToImage(paletteSize) {
    if (!snappedImageURL) {
        console.error(
            "Snapped image not available. Please snap the image to the grid first."
        );
        return;
    }
    const img = new Image();
    img.src = snappedImageURL; // use unchangd snapped image
    img.onload = async () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        try {
            const rgbQuant = new RgbQuant({ colors: paletteSize });
            rgbQuant.sample(imageData.data);
            const reducedData = rgbQuant.reduce(imageData.data, 2);
            const palette = rgbQuant.palette(true); // get palette
            if (!palette || palette.length === 0) {
                console.error("RgbQuant failed to generate a palette.");
                return;
            }
            const reducedImageData = ctx.createImageData(canvas.width, canvas.height);
            for (let i = 0; i < reducedData.length; i++) {
                const paletteIndex = reducedData[i];
                const offset = i * 4;
                const alpha = imageData.data[offset + 3];

                if (alpha === 0) {
                    reducedImageData.data[offset] = 0;
                    reducedImageData.data[offset + 1] = 0;
                    reducedImageData.data[offset + 2] = 0;
                    reducedImageData.data[offset + 3] = 0; // transparent
                } else if (paletteIndex >= 0 && paletteIndex < palette.length) {
                    const color = palette[paletteIndex];
                    reducedImageData.data[offset] = color[0]; // r
                    reducedImageData.data[offset + 1] = color[1]; // g
                    reducedImageData.data[offset + 2] = color[2]; // Blbue
                    reducedImageData.data[offset + 3] = 255; // opaque
                } else {
                    reducedImageData.data[offset] =
                        reducedImageData.data[offset + 1] =
                        reducedImageData.data[offset + 2] =
                            0;
                    reducedImageData.data[offset + 3] = 255;
                }
            }

            ctx.putImageData(reducedImageData, 0, 0);
            editedImageURL = canvas.toDataURL("image/png"); // update quantized image url

            // update editedb blob after quantization
            editedBlob = await fetch(editedImageURL).then((res) => res.blob());
            setupSnappedImage(editedImageURL);
            localStorage.setItem("editedImage", editedImageURL);
            console.log('LocalStorage updated with edited image after quantization');
        } catch (err) {
            console.error("Error during quantization:", err);
        }
    };
    img.onerror = () => console.error("Failed to load the snapped image for quantization.");
}

