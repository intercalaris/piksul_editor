const uploadInput = document.getElementById("upload");
const downloadButton = document.getElementById("download-button");
const blockSizeInput = document.getElementById("block-size-input");
const controls = document.getElementById("controls");
const outputOptions = document.getElementById("output-options");
const divisor = document.getElementById("divisor");
const slider = document.getElementById("slider");
const comparison = document.getElementById("comparison");
// const startProjectButton = document.getElementById("start-project-button");
const saveProjectButton = document.getElementById("save-project");
const deleteProjectButtons = document.querySelectorAll(".delete-project");
// const viewSavedProjectsButton = document.getElementById("view-saved-projects-button");
const paletteSizeSelect = document.getElementById("palette-size-select");
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
let lastAutoGrid = null;
const toggleColorChangeMapButton = document.getElementById("toggle-color-change-map-button");
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

document.querySelector(".spin-up")?.addEventListener("click", () => {
    const max = parseInt(blockSizeInput.max, 10);
    const val = parseInt(blockSizeInput.value, 10) || 4;
    blockSizeInput.value = Math.min(val + 1, max);
    blockSizeInput.dispatchEvent(new Event("input"));
});
document.querySelector(".spin-down")?.addEventListener("click", () => {
    const min = parseInt(blockSizeInput.min, 10);
    const val = parseInt(blockSizeInput.value, 10) || 4;
    blockSizeInput.value = Math.max(val - 1, min);
    blockSizeInput.dispatchEvent(new Event("input"));
});


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
    const yearElement = document.getElementById("year");
    if (yearElement) {
        yearElement.textContent = new Date().getFullYear();
    }
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

// CALCULATIONS — F-statistic grid detection

function colMeanLuma(data, width, rowStart, rowEnd, colStart, colEnd) {
    const rows = rowEnd - rowStart;
    const profile = new Float64Array(colEnd - colStart);
    for (let x = colStart; x < colEnd; x++) {
        let sum = 0;
        for (let y = rowStart; y < rowEnd; y++) {
            const i = (y * width + x) * 4;
            sum += 0.299*data[i] + 0.587*data[i+1] + 0.114*data[i+2];
        }
        profile[x - colStart] = sum / rows;
    }
    return profile;
}

function rowMeanLuma(data, width, rowStart, rowEnd, colStart, colEnd) {
    const cols = colEnd - colStart;
    const profile = new Float64Array(rowEnd - rowStart);
    for (let y = rowStart; y < rowEnd; y++) {
        let sum = 0;
        for (let x = colStart; x < colEnd; x++) {
            const i = (y * width + x) * 4;
            sum += 0.299*data[i] + 0.587*data[i+1] + 0.114*data[i+2];
        }
        profile[y - rowStart] = sum / cols;
    }
    return profile;
}

function rowLumaVariance(data, width, y, colStart, colEnd) {
    const n = colEnd - colStart;
    let s = 0, s2 = 0;
    for (let x = colStart; x < colEnd; x++) {
        const i = (y * width + x) * 4;
        const v = 0.299*data[i] + 0.587*data[i+1] + 0.114*data[i+2];
        s += v; s2 += v*v;
    }
    return s2/n - (s/n)**2;
}

function colLumaVariance(data, width, x, rowStart, rowEnd) {
    const n = rowEnd - rowStart;
    let s = 0, s2 = 0;
    for (let y = rowStart; y < rowEnd; y++) {
        const i = (y * width + x) * 4;
        const v = 0.299*data[i] + 0.587*data[i+1] + 0.114*data[i+2];
        s += v; s2 += v*v;
    }
    return s2/n - (s/n)**2;
}

function trimBlanks({ data, width, height }) {
    const THRESH = 10;
    let rowStart = 0, rowEnd = height;
    for (let y = 0; y < height; y++) {
        if (rowLumaVariance(data, width, y, 0, width) >= THRESH) { rowStart = y; break; }
    }
    for (let y = height-1; y >= rowStart; y--) {
        if (rowLumaVariance(data, width, y, 0, width) >= THRESH) { rowEnd = y+1; break; }
    }
    let colStart = 0, colEnd = width;
    for (let x = 0; x < width; x++) {
        if (colLumaVariance(data, width, x, rowStart, rowEnd) >= THRESH) { colStart = x; break; }
    }
    for (let x = width-1; x >= colStart; x--) {
        if (colLumaVariance(data, width, x, rowStart, rowEnd) >= THRESH) { colEnd = x+1; break; }
    }
    return { rowStart, rowEnd, colStart, colEnd };
}

function findBestN(profile) {
    const span = profile.length;
    const minN = Math.max(2, Math.floor(span / 50));
    const maxN = Math.floor(span / 4);
    const ps = new Float64Array(span + 1);
    const ps2 = new Float64Array(span + 1);
    for (let i = 0; i < span; i++) {
        ps[i+1] = ps[i] + profile[i];
        ps2[i+1] = ps2[i] + profile[i]*profile[i];
    }
    const rSum  = (a, b) => ps[b]  - ps[a];
    const rSum2 = (a, b) => ps2[b] - ps2[a];
    function computeF(N, xo) {
        const end = Math.min(xo + span, span);
        if (end - xo < N) return -1;
        const total = end - xo;
        const gm = rSum(xo, end) / total;
        let bss = 0, wss = 0;
        for (let k = 0; k < N; k++) {
            const a = xo + Math.floor(k * span / N);
            const b = Math.min(xo + Math.floor((k+1) * span / N), span);
            if (b <= a) continue;
            const bm = rSum(a, b) / (b-a);
            bss += (bm - gm)**2 * (b-a);
            wss += rSum2(a, b) - bm*bm*(b-a);
        }
        const dfB = N-1, dfW = total-N;
        return (dfW <= 0 || wss <= 0) ? -1 : (bss/dfB) / (wss/dfW);
    }
    const fScores = new Float64Array(maxN + 1);
    for (let N = minN; N <= maxN; N++) {
        let best = -1;
        for (let xo = 0; xo < Math.ceil(span / N); xo++) {
            const f = computeF(N, xo);
            if (f > best) best = f;
        }
        fScores[N] = best;
    }
    let bestN = minN, bestF = -Infinity;
    for (let N = minN + 1; N < maxN; N++) {
        if (fScores[N] > fScores[N-1] && fScores[N] > fScores[N+1] && fScores[N] > bestF) {
            bestF = fScores[N]; bestN = N;
        }
    }
    if (bestF === -Infinity) {
        for (let N = minN; N <= maxN; N++) {
            if (fScores[N] > bestF) { bestF = fScores[N]; bestN = N; }
        }
    }
    let bestXo = 0, bestOffF = computeF(bestN, 0);
    for (let xo = 1; xo < Math.ceil(span / bestN); xo++) {
        const f = computeF(bestN, xo);
        if (f > bestOffF) { bestOffF = f; bestXo = xo; }
    }
    if (bestXo !== 0 && computeF(bestN, 0) * 1.05 >= bestOffF) bestXo = 0;
    return { N: bestN, xo: bestXo, F: fScores[bestN] };
}

function findBestOffsetForN(profile, N) {
    const span = profile.length;
    const ps = new Float64Array(span + 1);
    const ps2 = new Float64Array(span + 1);
    for (let i = 0; i < span; i++) {
        ps[i+1] = ps[i] + profile[i];
        ps2[i+1] = ps2[i] + profile[i]*profile[i];
    }
    const rSum  = (a, b) => ps[b]  - ps[a];
    const rSum2 = (a, b) => ps2[b] - ps2[a];
    function computeF(xo) {
        const end = Math.min(xo + span, span);
        if (end - xo < N) return -1;
        const total = end - xo;
        const gm = rSum(xo, end) / total;
        let bss = 0, wss = 0;
        for (let k = 0; k < N; k++) {
            const a = xo + Math.floor(k * span / N);
            const b = Math.min(xo + Math.floor((k+1) * span / N), span);
            if (b <= a) continue;
            const bm = rSum(a, b) / (b-a);
            bss += (bm - gm)**2 * (b-a);
            wss += rSum2(a, b) - bm*bm*(b-a);
        }
        const dfB = N-1, dfW = total-N;
        return (dfW <= 0 || wss <= 0) ? -1 : (bss/dfB) / (wss/dfW);
    }
    let bestXo = 0, bestF = computeF(0);
    for (let xo = 1; xo < Math.ceil(span / N); xo++) {
        const f = computeF(xo);
        if (f > bestF) { bestF = f; bestXo = xo; }
    }
    if (bestXo !== 0 && computeF(0) * 1.05 >= bestF) bestXo = 0;
    return { xo: bestXo };
}

function estimateGrid(imageData) {
    const { data, width, height } = imageData;
    const { rowStart, rowEnd, colStart, colEnd } = trimBlanks(imageData);
    const spanX = colEnd - colStart, spanY = rowEnd - rowStart;
    const colProfile = colMeanLuma(data, width, rowStart, rowEnd, colStart, colEnd);
    const rowProfile = rowMeanLuma(data, width, rowStart, rowEnd, colStart, colEnd);
    const xR = findBestN(colProfile);
    const yR = findBestN(rowProfile);
    let N_x = xR.N, xo = xR.xo + colStart;
    let N_y = yR.N, yo = yR.xo + rowStart;
    const bsX = spanX / N_x, bsY = spanY / N_y;
    if (Math.abs(bsX - bsY) / Math.max(bsX, bsY) > 0.15) {
        if (xR.F >= yR.F) {
            N_y = Math.max(1, Math.round(spanY / bsX));
            yo = findBestOffsetForN(rowProfile, N_y).xo + rowStart;
        } else {
            N_x = Math.max(1, Math.round(spanX / bsY));
            xo = findBestOffsetForN(colProfile, N_x).xo + colStart;
        }
    }
    const approxBlockSize = (spanX / N_x + spanY / N_y) / 2;
    console.log(`estimateGrid: N_x=${N_x} N_y=${N_y} approx=${approxBlockSize.toFixed(2)} offset=(${xo},${yo}) span=${spanX}×${spanY}`);
    return { N_x, xo, N_y, yo, spanX, spanY, approxBlockSize };
}

function estimateGridManual(imageData, blockSizeHint) {
    const { data, width, height } = imageData;
    const { rowStart, rowEnd, colStart, colEnd } = trimBlanks(imageData);
    const spanX = colEnd - colStart, spanY = rowEnd - rowStart;
    const N_x = Math.max(1, Math.round(spanX / blockSizeHint));
    const N_y = Math.max(1, Math.round(spanY / blockSizeHint));
    const colProfile = colMeanLuma(data, width, rowStart, rowEnd, colStart, colEnd);
    const rowProfile = rowMeanLuma(data, width, rowStart, rowEnd, colStart, colEnd);
    const xo = findBestOffsetForN(colProfile, N_x).xo + colStart;
    const yo = findBestOffsetForN(rowProfile, N_y).xo + rowStart;
    const approxBlockSize = (spanX / N_x + spanY / N_y) / 2;
    console.log(`estimateGridManual(hint=${blockSizeHint}): N_x=${N_x} N_y=${N_y} approx=${approxBlockSize.toFixed(2)} offset=(${xo},${yo})`);
    return { N_x, xo, N_y, yo, spanX, spanY, approxBlockSize };
}

function estimateBlockSize(img) {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, img.width, img.height);
    lastAutoGrid = estimateGrid(imageData);
    return Math.round(lastAutoGrid.approxBlockSize);
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
    const img = new Image();
    await new Promise((resolve, reject) => {
        img.src = originalImageURL;
        img.onload = resolve;
        img.onerror = () => {
            console.error("Failed to load the original image for snapping.");
            reject(new Error("Failed to load the original image for snapping."));
        };
    });

    const srcCanvas = document.createElement("canvas");
    const srcCtx = srcCanvas.getContext("2d");
    srcCanvas.width = img.width;
    srcCanvas.height = img.height;
    srcCtx.drawImage(img, 0, 0);
    const imageData = srcCtx.getImageData(0, 0, img.width, img.height);
    const data = imageData.data;
    const srcWidth = img.width;
    const srcHeight = img.height;

    const grid = (lastAutoGrid && Math.abs(blockSize - lastAutoGrid.approxBlockSize) < 0.5)
        ? lastAutoGrid
        : estimateGridManual(imageData, blockSize);
    const { N_x, xo, N_y, yo, spanX, spanY } = grid;

    console.log(`Snapping: N_x=${N_x} N_y=${N_y} approx=${grid.approxBlockSize.toFixed(2)} offset=(${xo},${yo}) span=${spanX}×${spanY}`);

    const canvas = document.createElement("canvas");
    canvas.width = N_x;
    canvas.height = N_y;
    const ctx = canvas.getContext("2d");
    const outImageData = ctx.createImageData(N_x, N_y);
    const outData = outImageData.data;

    for (let by = 0; by < N_y; by++) {
        const sy1 = yo + Math.floor(by * spanY / N_y);
        const sy2 = yo + Math.floor((by+1) * spanY / N_y);
        for (let bx = 0; bx < N_x; bx++) {
            const sx1 = xo + Math.floor(bx * spanX / N_x);
            const sx2 = xo + Math.floor((bx+1) * spanX / N_x);
            const rs = [], gs = [], bs = [], as = [];
            const iy1 = sy2 - sy1 > 4 ? sy1 + 2 : sy1;
            const iy2 = sy2 - sy1 > 4 ? sy2 - 2 : sy2;
            const ix1 = sx2 - sx1 > 4 ? sx1 + 2 : sx1;
            const ix2 = sx2 - sx1 > 4 ? sx2 - 2 : sx2;
            for (let py = iy1; py < iy2; py++) {
                for (let px = ix1; px < ix2; px++) {
                    const si = (Math.min(py, srcHeight-1) * srcWidth + Math.min(px, srcWidth-1)) * 4;
                    rs.push(data[si]); gs.push(data[si+1]); bs.push(data[si+2]); as.push(data[si+3]);
                }
            }
            rs.sort((a,b)=>a-b); gs.sort((a,b)=>a-b); bs.sort((a,b)=>a-b); as.sort((a,b)=>a-b);
            const mid = (rs.length - 1) / 2;
            const lo = Math.floor(mid), hi = Math.ceil(mid);
            const r = Math.round((rs[lo]+rs[hi])/2);
            const g = Math.round((gs[lo]+gs[hi])/2);
            const b = Math.round((bs[lo]+bs[hi])/2);
            const a = Math.round((as[lo]+as[hi])/2);
            const dstIdx = (by * N_x + bx) * 4;
            outData[dstIdx]     = r;
            outData[dstIdx + 1] = g;
            outData[dstIdx + 2] = b;
            outData[dstIdx + 3] = a;
        }
    }

    ctx.putImageData(outImageData, 0, 0);
    snappedImageURL = canvas.toDataURL("image/png");
    editedImageURL = snappedImageURL;
    editedBlob = await fetch(editedImageURL).then((res) => res.blob());

    const croppedOrigCanvas = document.createElement("canvas");
    croppedOrigCanvas.width  = spanX;
    croppedOrigCanvas.height = spanY;
    croppedOrigCanvas.getContext("2d").drawImage(
        srcCanvas, xo, yo, spanX, spanY, 0, 0, spanX, spanY
    );
    document.querySelector("#comparison figure").style.backgroundImage =
        `url(${croppedOrigCanvas.toDataURL("image/png")})`;
    comparison.style.aspectRatio = `${spanX / spanY}`;

    setupSnappedImage(editedImageURL);
    localStorage.setItem("editedImage", editedImageURL);
    console.log(`LocalStorage updated with edited image after snapping`);
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
            // Extract unique opaque colors from the snapped image
            const colorCount = new Map(); // rgb24 -> count
            const data = imageData.data;
            for (let i = 0; i < data.length; i += 4) {
                if (data[i + 3] === 0) continue;
                const key = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
                colorCount.set(key, (colorCount.get(key) || 0) + 1);
            }

            let palette; // [[r,g,b], ...]

            if (colorCount.size <= paletteSize) {
                // All unique block colors fit — no reduction needed
                palette = Array.from(colorCount.keys()).map(k => [k >> 16, (k >> 8) & 0xff, k & 0xff]);
            } else {
                // More unique colors than palette slots — use RgbQuant method:1 (global histogram)
                const rgbQuant = new RgbQuant({ colors: paletteSize, method: 1, minHueCols: 2 });
                rgbQuant.sample(imageData);
                const pal = rgbQuant.palette(true);
                palette = pal;
            }

            if (!palette || palette.length === 0) {
                console.error("Failed to generate a palette.");
                return;
            }

            // Map each pixel to the nearest palette color
            const reducedImageData = ctx.createImageData(canvas.width, canvas.height);
            for (let i = 0; i < data.length; i += 4) {
                const alpha = data[i + 3];
                if (alpha === 0) {
                    reducedImageData.data[i + 3] = 0;
                    continue;
                }
                const r = data[i], g = data[i + 1], b = data[i + 2];
                let bestIdx = 0, bestDist = Infinity;
                for (let j = 0; j < palette.length; j++) {
                    const pr = palette[j][0], pg = palette[j][1], pb = palette[j][2];
                    const dr = r - pr, dg = g - pg, db = b - pb;
                    const dist = 0.2126*dr*dr + 0.7152*dg*dg + 0.0722*db*db;
                    if (dist < bestDist) { bestDist = dist; bestIdx = j; }
                }
                reducedImageData.data[i]     = palette[bestIdx][0];
                reducedImageData.data[i + 1] = palette[bestIdx][1];
                reducedImageData.data[i + 2] = palette[bestIdx][2];
                reducedImageData.data[i + 3] = 255;
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

