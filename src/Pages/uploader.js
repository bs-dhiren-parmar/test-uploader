var {
    createOrUpdateFileUpload,
    getPatients,
    getPatientById,
    initiateMultipartUpload,
    getSignedUrlsForAllPart,
    completeSignedUrl,
    logoutUser,
    canceldeleteFileUpload,
    cancelAllFileUpload,
    addSampleId,
} = require("./utils/apiServerics");
var Queue = require("./utils/Queue");
var isUploading = {},
    isCacelAvail = {},
    keyObj = {},
    initialCardValue = {
        patientOption: "",
        visits: null,
        samples: null,
        visitOption: "",
        sampleOption: "",
        sampleValue: "",
        files: [],
        updatedFileNames: {},
        fileTypes: [],
    },
    sampleCard = [initialCardValue],
    patientList = [],
    fileUploadQueue = new Queue(),
    isUploadFileInProgress = false,
    cancelTokenSource;
var chunkSize = 100 * 1024 * 1000;

$("document").ready(() => {
    const {objectToQueryString, getLocalDateTime, VERSION} = require("./utils");
    const API_URL = localStorage.getItem("API_URL");
    const url = `${API_URL}/api/file-upload/data-tables`;
    setLogin();
    fetchPatients(true);

    /* change page title based on tab selected */
    $(".nav-item").click(async (event) => {
        event.preventDefault();
        let control = $(event.target).attr("aria-controls");
        const pageTitle = control === "uploader" ? "Uploader" : "File List";
        $("#pageTitle").text(pageTitle);
    });

    /* set file list table */
    $("#myTable").DataTable({
        processing: true,
        serverSide: true,
        paging: true,
        searching: {regex: true},
        order: [[7, "desc"]],
        serverMethod: "get",
        ajax: function (data, callback) {
            const isConnected = navigator.onLine;
            if (isConnected) {
                const queryString = objectToQueryString(data);
                $.ajax({
                    url: `${url}?${queryString}`,
                    headers: {
                        "api-key": localStorage.getItem("apiKey"),
                    },
                }).then(function (json) {
                    const resoponsData = {
                        data: json.data.data,
                        draw: json.data.draw,
                        recordsTotal: json.data.recordsTotal,
                        recordsFiltered: json.data.recordsFiltered,
                        iTotalRecords: json.data.iTotalRecords,
                        iTotalDisplayRecord: json.data.iTotalDisplayRecord,
                    };
                    callback(resoponsData);
                });
            } else {
                callback({
                    data: [],
                    draw: "1",
                    recordsTotal: 0,
                    recordsFiltered: 0,
                    iTotalRecords: 0,
                    iTotalDisplayRecord: 0,
                });
            }
        },
        columns: [
            {data: "file_name"},
            {data: "original_file_name"},
            {data: "upload_status"},
            {data: "file_progress"},
            {data: "patient_name"},
            {data: "visit_id"},
            {data: "sample_id"},
            {
                data: "created_at",
                sortable: true,
                render: (obj) => {
                    return getLocalDateTime(obj) || "";
                },
            },
            {
                data: "upload_completed_at",
                sortable: true,
                render: (data) => {
                    return getLocalDateTime(data) || "";
                },
            },
            {
                data: null,
                sortable: false,
                render: (obj) => {
                    if (obj.upload_status === "COMPLETED") {
                        return `
                                <div class="action-div">
                                    <a class="btn btn-outline-primary symbol-btn" href="${obj.aws_key}"  target="_blank">
                                        Download
                                    </a>
                                    <button class="btn btn-outline-danger symbol-btn file-delete" data-id="${obj._id}" onclick='hanldeDelete();'>
                                        Delete
                                    </button>
                                </div>
                            `;
                    } else {
                        let htmlStr = '<div class="action-div">';
                        htmlStr += `<button class="btn btn-outline-primary" data-file-path="${obj.local_file_path}" onclick="handleShowFilePath();">
                                            File Path
                                        </button>`;
                        if (obj.upload_status === "ERROR" || obj.upload_status === "CANCEL") {
                            htmlStr += `<button class="btn btn-outline-warning" data-file-name="${obj.file_name}" data-file-path="${obj.local_file_path}" data-fileobj-id="${obj._id}" data-fileupload-id="${obj.aws_upload_id}" data-key="${obj.aws_key}" data-current-part-index="${obj.currentPartIndex || 0}" onclick="handleResume();">Resume</button>`;
                        }
                        if (
                            obj.upload_status !== "RETRIED_IN_PROGRESS" &&
                            obj.upload_status !== "COMPLETED_WITH_ERROR" &&
                            Object.keys(isCacelAvail).length &&
                            isCacelAvail[obj._id]
                        ) {
                            htmlStr += `<button class="btn btn-outline-danger" data-id="${obj._id}" data-status=${obj.upload_status} onclick="handleCancel();">
                                                Cancel
                                            </button>`;
                        }
                        htmlStr += "</div>";
                        return htmlStr;
                    }
                },
            },
        ],
    });

    /* logout Btn functionality */
    $("#logoutBtn").click(async (event) => {
        event.preventDefault();
        const API_URL = localStorage.getItem("API_URL");
        const apiKey = localStorage.getItem("apiKey");
        const {ipcRenderer} = require("electron");
        let isRereshAllowed = true;
        if (isUploading) {
            for (const val of Object.values(isUploading)) {
                if (!val) {
                    isRereshAllowed = false;
                    break;
                }
            }
        }
        if (!isRereshAllowed) {
            let isRefresh = await ipcRenderer.invoke("showCloseConfirmBox");
            isRereshAllowed = isRefresh === 1;
        }
        if (isRereshAllowed) {
            if (navigator.onLine) {
                await cancelAllFileUpload(API_URL, apiKey, Object.keys(isUploading), keyObj).catch((error) => {
                    console.error("%c 🍐 error", "color:#42b983", error);
                });
                if(!localStorage.getItem("isKeepLoginIn")){
                    localStorage.removeItem("apiKey");
                    localStorage.removeItem("API_URL");
                    localStorage.removeItem("org_id");
                }
                localStorage.removeItem("isUserActive");
                ipcRenderer.invoke("keepLoginDetails", {apiKey: "", baseUrl: ""});
                checkFunction();
            } else {
                if(!localStorage.getItem("isKeepLoginIn")){
                    localStorage.removeItem("apiKey");
                    localStorage.removeItem("API_URL");
                    localStorage.removeItem("org_id");
                }
                localStorage.removeItem("isUserActive");
                ipcRenderer.invoke("keepLoginDetails", {apiKey: "", baseUrl: ""});
                checkFunction();
            }
        }
    });

    /* Add sampels on uploader ui */
    $("#addSampleCard").click(async () => {
        sampleCard.push(initialCardValue);
        handleUpdateCardView(sampleCard.length - 1, false);
    });
    $(".version").html(`(v${VERSION})`)
    $(".userInfo").html(`
        <span class="fw-bold">User: </span><span>${localStorage.getItem('userName')}</span>
        <span class="text-primary">(${localStorage.getItem('email')})</span>
    `)
});

/* method used for keeping login on server side */
setLogin = () => {
    const {ipcRenderer} = require("electron");
    ipcRenderer.invoke("keepLoginDetails", {apiKey: localStorage.getItem("apiKey"), baseUrl: localStorage.getItem("API_URL")});
};

/* table action methods start */
/* delete the file upload from list */
hanldeDelete = async () => {
    const id = $(event.target).data("id");
    if (id) {
        let delResponse = await canceldeleteFileUpload(id, "delete");
        if (delResponse && delResponse.data && delResponse.data.success) {
            $("#myTable").DataTable().ajax.reload();
        }
    }
};

/* shows the file path of uploaded file in users machine*/
handleShowFilePath = () => {
    const {ipcRenderer} = require("electron");
    const filePath = $(event.target).data("file-path");
    if (filePath) {
        ipcRenderer.invoke("showInfoBox", {
            message: `The file uploaded by user is at ${filePath} of users machine.`,
            type: "info",
            buttons: ["Ok"],
        });
    }
};

/* method to cancel file upload */
handleCancel = async () => {
    const id = $(event.target).data("id");
    const status = $(event.target).data("status");
    isCacelAvail[id] = false;
    isUploading[id] = true;
    updateIsUploading(isUploading);
    let delResponse = await canceldeleteFileUpload(id, "cancel", keyObj[id]);
    delete keyObj[id];
    updateKeyObj(keyObj);
    if (delResponse && delResponse.data && delResponse.data.success) {
        if (cancelTokenSource && status === "IN_PROGRESS") {
            cancelTokenSource.cancel();
            cancelTokenSource = null;
        }
        $("#myTable").DataTable().ajax.reload();
    }
};

/* method to resume file upload */
handleResume = async () => {
    const fileName = $(event.target).data("file-name");
    const filePath = $(event.target).data("file-path");
    const fileUploadId = $(event.target).data("fileobj-id");
    const uploadId = $(event.target).data("fileupload-id");
    const key = $(event.target).data("key");
    const currentPartIndex = $(event.target).data("current-part-index") || 0;
    try {
        let file = await getFileObject(filePath, fileName);
        isUploading[fileUploadId] = false;
        updateIsUploading(isUploading);
        isCacelAvail[fileUploadId] = true;
        fileUploadQueue.enqueue({file, key, fileUploadId, uploadId, isFileResume: true, currentPartIndex, fileName});
        await createOrUpdateFileUpload({
            id: fileUploadId,
            status: "QUEUED",
            updateStatus: true,
        });
        $("#myTable").DataTable().ajax.reload();
        if (!isUploadFileInProgress) {
            isUploadFileInProgress = true;
            uploadFile();
        }
    } catch (error) {
        const {ipcRenderer} = require("electron");
        ipcRenderer.invoke("showErrorBox", {title: "File Not Found", message: "File is not present in location we stored"});
    }
};
/* table action methods end */

/* method used to update server constant still upload in progress */
updateIsUploading = (data) => {
    const {ipcRenderer} = require("electron");
    ipcRenderer.invoke("closeActionCheck", {data});
};

/* opens a error popup with message */
showNetworkError = () => {
    const {ipcRenderer} = require("electron");
    ipcRenderer.invoke("showErrorBox", {title: "Network Error", message: "Please connect to network"});
};

/* method to update keys on server side */
updateKeyObj = (data) => {
    const {ipcRenderer} = require("electron");
    ipcRenderer.invoke("KeyObjUpdate", {data});
};

/* method to fetch patients */
fetchPatients = (isRenderCard = false) => {
    if (navigator.onLine) {
        $("#patientProcessing").css({display: "block"});
        $("#uploderContent").css({display: "none"});
        getPatients()
            .then((result) => {
                if (result.data && result.data.data && result.data.data.response && result.data.data.response.length) {
                    patientList = result.data.data.response;
                }
                $("#patientProcessing").css({display: "none"});
                $("#uploderContent").css({display: "block"});
                if (isRenderCard) {
                    handleUpdateCardView(null, true);
                }
            })
            .catch((error) => {
                $("#patientProcessing").css({display: "none"});
                $("#uploderContent").css({display: "block"});
                console.error("%c 🥨 Patient Detail Err: ", "font-size:20px;background-color: #2EAFB0;color:#fff;", error.message);
                if (error.response && (error.response.status === 401 || error.response.status === 0)) {
                    localStorage.removeItem("isUserActive");
                    checkFunction();
                }
            });
    } else {
        let htmlStr = "<option value=''> </option>";
        $("#patients").html(htmlStr);
        $("#patients").attr("disabled", false);
        $("#patients").chosen();
    }
};

/* method to remove sample card */
removeSampleCard = (index) => {
    sampleCard.splice(index, 1);
    $(`#card-${index}`).remove();
};

/* method to provide patient form dynamically */
getPatientForm = (index) => {
    return `
        <div class="card bg-light m-3" id="card-${index}">
            <div class="card-body">
                <div id="patientCardProcessing-${index}" class="dataTables_processing patientCardProcessing d-none">
                    <div>
                        <div></div>
                        <div></div>
                        <div></div>
                        <div></div>
                    </div>
                </div>
                <form class="patient-sample-form">
                    <div class="row">
                        <div class="form-group mb-3 col-md-4">
                            <label class="mt-2 text-dark" for="patients-${index}">
                                <span class="asterik">Patients *</span>
                            </label>
                            <select class="form-select patients-dropdown" id="patients-${index}" data-index="${index}" disabled="true">
                                <option value="">loading</option>
                            </select>
                        </div>
                        <div class="form-group mb-3 col-md-3" data-index="${index}" id="visits-div-${index}">
                            <label class="mt-2 text-dark" for="visits">
                                <span class="asterik">Patient Visits *</span>
                            </label>

                            <select class="form-select" id="visits-${index}" data-index="${index}" disabled="true">
                                <option value="">loading</option>
                            </select>
                        </div>

                        <div class="form-group mb-3 col-md-4" data-index="${index}" id="samples-div-${index}">
                            <label class="mt-2 text-dark" for="samples">
                                <span class="asterik">Sample Id *</span>
                            </label>

                            <select class="form-select" id="samples-${index}" data-index="${index}" disabled="true">
                                <option value="">loading</option>
                            </select>
                            <div class='hr-or'></div>
                            <div class="row col-12 m-0">
                                <div class="col-8">
                                    <input class="form-input w-100 h-100" id="samples-input-${index}" data-index="${index}" onKeyUp="sampleInputChange(this.value, ${index});" disabled=true placeholder="Create New Sample"></input>
                                </div>
                                <div class="col-4">
                                    <button type="button" class="btn btn-primary w-100" id="add-sample-btn-${index}" disabled="${true}" onClick="handleAddSampleId(${index})">+ Sample Id</button>
                                </div>
                                <div>
                                    <span class="text-danger" id="error-sample-${index}"></span>
                                </div>
                            </div>
                        </div>
                        <div class="form-group mb-3 col-md-1 text-danger close-div">
                            <button type="button" class="btn btn-light" id="close-btn-${index}" onClick="removeSampleCard(${index});">
                                <span class="text-danger">X</span>
                            </button>
                        </div>
                    </div>
                    <div class="drop-zone-${index} invisible">
                        <div class="file-upload p-5" data-index="${index}" id="drop-file-${index}" onDrop="fileDrop(event)" ondragover="fileDragOver(event)" ondragenter="fileDragEnter(event)" ondragleave="fileDragLeave(event)">
                            <div class="icon">
                                <svg viewBox="0 0 384 512" width="100px" height="100px" xmlns="http://www.w3.org/2000/svg">
                                    <path
                                        d="M224 136V0H24C10.7 0 0 10.7 0 24v464c0 13.3 10.7 24 24 24h336c13.3 0 24-10.7 24-24V160H248c-13.2 0-24-10.8-24-24zm65.18 216.01H224v80c0 8.84-7.16 16-16 16h-32c-8.84 0-16-7.16-16-16v-80H94.82c-14.28 0-21.41-17.29-11.27-27.36l96.42-95.7c6.65-6.61 17.39-6.61 24.04 0l96.42 95.7c10.15 10.07 3.03 27.36-11.25 27.36zM377 105L279.1 7c-4.5-4.5-10.6-7-17-7H256v128h128v-6.1c0-6.3-2.5-12.4-7-16.9z"
                                    />
                                </svg>
                            </div>
                            <header>Drag & Drop to Upload File</header>
                            <div class"file-names" id="file-names-${index}"></div>
                            <div class="uplod-btn-div invisible" id="upload-btn-${index}">
                                <button type="button" class="btn btn-success" onClick="handleFileUpload(${index});">
                                    Upload files
                                </button>
                            </div>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    `;
};

handleUpdateCardView = (addIndex, renderAll = false) => {
    if (sampleCard && sampleCard.length > -1) {
        let patientListHtml = "";
        if (patientList?.length) {
            patientListHtml += `<option value=''></option>`;
            for (const option of patientList) {
                let patientName = "";
                if(option.first_name) patientName = option.first_name;
                if(option.last_name) patientName +=` ${option.last_name}`;
                patientListHtml += `<option value='${option._id}'>${patientName} - [${option.mrn}]</option>`;
            }
        }
        if (renderAll) {
            for (let index in sampleCard) {
                let data = sampleCard[index];
                let htmlStr = getPatientForm(index);
                if (data.patientOption) {
                    patientListHtml = "<option value=''> </option>";
                    for (const option of patientList) {
                        patientListHtml += `<option value='${option._id}' selected=${option._id === data.patientOption}>${option.first_name} ${
                            option.last_name
                        }-[${option.mrn}]</option>`;
                    }
                }
                $("#sampleCards").append(htmlStr);
                $(`#patients-${index}`).html(patientListHtml);
                $(`#patients-${index}`).attr("disabled", false);
                $(`#patients-${index}`)
                    .chosen({allow_single_deselect: true})
                    .change((e) => patientChange(e));
            }
        } else {
            let htmlStr = getPatientForm(addIndex);
            $("#sampleCards").append(htmlStr);
            $(`#patients-${addIndex}`).html(patientListHtml);
            $(`#patients-${addIndex}`).attr("disabled", false);
            $(`#patients-${addIndex}`)
                .chosen({allow_single_deselect: true})
                .change((e) => patientChange(e));
        }
    }
};

/* patient dropdown change */
patientChange = (event) => {
    let currentIndex = $(event.target).data("index");
    if (event.target.value) {
        if (navigator.onLine) {
            $(`#visits-${currentIndex}`).chosen("destroy");
            $(`#samples-${currentIndex}`).chosen("destroy");
            $(`#file-names-${currentIndex}`).html("");
            $(`#upload-btn-${currentIndex}`).addClass("invisible");
            sampleCard[currentIndex].files = [];
            sampleCard[currentIndex].updatedFileNames = {};
            getPatientById(event.target.value)
                .then((result) => {
                    sampleCard[currentIndex]["patientOption"] = event.target.value;
                    sampleCard[currentIndex]["visitOption"] = null;
                    sampleCard[currentIndex]["sampleOption"] = null;
                    // $(`#samples-div-${currentIndex}`).addClass("invisible");
                    let htmlVisitsStr = "<option value=''> </option>";
                    if (result.data && result.data.data) {
                        let {visits, samples} = result.data.data;
                        sampleCard[currentIndex]["visits"] = visits;
                        sampleCard[currentIndex]["samples"] = samples;
                        if (visits && visits.length) {
                            for (let visit of visits) {
                                htmlVisitsStr += `<option value='${visit.visit_id}'>${visit.visit_id}</option>`;
                            }
                        }
                    }
                    $(`#visits-${currentIndex}`).html(htmlVisitsStr);
                    $(`#visits-${currentIndex}`).attr("disabled", false);
                    $(`#visits-${currentIndex}`)
                        .chosen({allow_single_deselect: true})
                        .change((e) => visitChange(e));
                })
                .catch((error) => {
                    console.error("%c 🍶 Patient Err: ", "font-size:20px;background-color: #2EAFB0;color:#fff;", error.message);
                    if (error.response && (error.response.status === 401 || error.response.status === 0)) {
                        localStorage.removeItem("isUserActive");
                        checkFunction();
                    }
                });
        } else {
            showNetworkError();
        }
    } else {
        $(`.drop-zone-${currentIndex}`).addClass("invisible");
        sampleCard[currentIndex]["visits"] = null;
        sampleCard[currentIndex]["samples"] = null;
        $(`#visits-${currentIndex}`).chosen("destroy");
        $(`#visits-${currentIndex}`).attr("disabled", true);
        $(`#samples-${currentIndex}`).chosen("destroy");
        $(`#samples-${currentIndex}`).attr("disabled", true);
        $(`#samples-input-${currentIndex}`).attr("disabled", true);
        $(`#file-names-${currentIndex}`).html("");
        $(`#upload-btn-${currentIndex}`).addClass("invisible");
        sampleCard[currentIndex].files = [];
        sampleCard[currentIndex].updatedFileNames = {};
    }
};

/* visits dropdown change */
visitChange = (event) => {
    let currentIndex = $(event.target).data("index");
    $(`#file-names-${currentIndex}`).html("");
    $(`#upload-btn-${currentIndex}`).addClass("invisible");
    sampleCard[currentIndex].files = [];
    sampleCard[currentIndex].updatedFileNames = {};
    let visitId = event.target.value;
    if (visitId) {
        sampleCard[currentIndex]["visitOption"] = visitId;
        $(`#samples-${currentIndex}`).chosen("destroy");
        let sampleList = sampleCard[currentIndex]["samples"] || {};
        let samples = sampleList[visitId];
        if (samples && samples.length) {
            let htmlSamplesStr = "<option value=''> </option>";
            for (const sampleId of samples) {
                htmlSamplesStr += `<option value='${sampleId}'>${sampleId}</option>`;
            }
            $(`#samples-${currentIndex}`).html(htmlSamplesStr);
            $(`#samples-${currentIndex}`).attr("disabled", false);
            $(`#samples-input-${currentIndex}`).attr("disabled", false);
            $(`#samples-${currentIndex}`)
                .chosen({allow_single_deselect: true})
                .change((e) => sampleChange(e));
        }
    } else {
        sampleCard[currentIndex]["visitOption"] = "";
        $(`#samples-${currentIndex}`).chosen("destroy");
        $(`#samples-${currentIndex}`).attr("disabled", true);
        $(`#samples-input-${currentIndex}`).attr("disabled", true);
    }
};

/* samples dropdown change */
sampleChange = (event) => {
    let currentIndex = $(event.target).data("index");
    sampleCard[currentIndex]["sampleOption"] = event.target.value;
    $(`#file-names-${currentIndex}`).html("");
    $(`#upload-btn-${currentIndex}`).addClass("invisible");
    sampleCard[currentIndex].files = [];
    sampleCard[currentIndex].updatedFileNames = {};
    if (event.target.value) {
        $(`.drop-zone-${currentIndex}`).removeClass("invisible");
    } else {
        $(`.drop-zone-${currentIndex}`).addClass("invisible");
    }
};

/* samples input change */
sampleInputChange = (value, currentIndex) => {
    if (value) {
        $(`#add-sample-btn-${currentIndex}`).attr("disabled", false);
        sampleCard[currentIndex]["sampleValue"] = value;
    } else {
        $(`#samples-${currentIndex}`).attr("disabled", false);
        $(`#add-sample-btn-${currentIndex}`).attr("disabled", true);
        sampleCard[currentIndex]["sampleValue"] = "";
    }
};

/* add samples to visit api call */
handleAddSampleId = async (currentIndex) => {
    let {patientOption, visitOption, sampleValue} = sampleCard[currentIndex] || {};
    let samples = sampleCard[currentIndex].samples[visitOption];
    if (samples.includes(sampleValue)) {
        $(`#error-sample-${currentIndex}`).html(`${sampleValue} already exists in samples`);
        return;
    } else {
        $(`#error-sample-${currentIndex}`).html(``);
    }
    try {
        const API_URL = localStorage.getItem("API_URL");
        const apiKey = localStorage.getItem("apiKey");
        let response = await addSampleId(API_URL, apiKey, patientOption, visitOption, sampleValue);
        if (response?.data && response?.data?.success && response?.data?.data) {
            $(`#samples-input-${currentIndex}`).val("");
            let {samples} = response.data.data;
            let _samples = samples[visitOption];
            if (_samples && _samples.length) {
                $(`#samples-${currentIndex}`).chosen("destroy");
                let htmlSamplesStr = "<option value=''> </option>";
                for (const _sampleId of _samples) {
                    htmlSamplesStr += `<option value='${_sampleId}' selected=${_sampleId === sampleValue ? "selected" : ""}>${_sampleId}</option>`;
                }
                $(`#samples-${currentIndex}`).html(htmlSamplesStr);
                $(`#samples-${currentIndex}`).attr("disabled", false);
                $(`#samples-${currentIndex}`).chosen();
            }
            sampleCard[currentIndex]["sampleOption"] = sampleValue;
            sampleCard[currentIndex]["samples"] = samples;
            sampleCard[currentIndex]["sampleValue"] = "";
            $(`#add-sample-btn-${currentIndex}`).attr("disabled", true);
            $(`.drop-zone-${currentIndex}`).removeClass("invisible");
            $(`#file-names-${currentIndex}`).html("");
            $(`#upload-btn-${currentIndex}`).addClass("invisible");
            sampleCard[currentIndex].files = [];
            sampleCard[currentIndex].updatedFileNames = {};
            $(`#error-sample-${currentIndex}`).html("");
        } else {
            let message = response?.data?.message;
            $(`#error-sample-${currentIndex}`).html(message);
        }
    } catch (error) {
        console.error("%c Line:528 🥤 error", "color:#2eafb0", error);
        const {ipcRenderer} = require("electron");
        ipcRenderer.invoke("showErrorBox", {title: "Add Sample Id Failed", message: error.message});
    }
};

fileNameHtml = (isCorrectExtension, fileName, currentIndex, fileType) => {
    let fileHtml = "";
    if (isCorrectExtension || fileType) {
        fileHtml = `<div class="d-flex justify-content-between mb-2">
            <span class="${fileType === "uncompressed_fastq" ? "text-danger" : "text-success"} d-flex justify-content-center align-items-center">${fileName}</span>
            <select class="mx-2" disabled>
            <option value=""></option>
            <option value="fastq" ${fileType === "fastq" ? "selected" : ""}>fastq</option>
            <option value="bam" ${fileType === "bam" ? "selected" : ""}>bam</option>
            <option value="bam" ${fileType === "bai" ? "selected" : ""}>bai</option>
            <option value="vcf" ${fileType === "vcf" ? "selected" : ""}>vcf</option>
            <option value="others" ${fileType === "others" ? "selected" : ""}>Others</option>
            </select>
            <button type="button" class="btn btn-white" onclick="removeFileFromCard(${currentIndex},'${fileName}');">
            ${fileType === "uncompressed_fastq" ? `<span class="text-danger justify-content-center align-items-center">Please compress file before upload</span>` : ""}
            <span class="text-danger">X</span>
            </button>
        </div>`;
    } else {
        fileHtml = `<div class="d-flex justify-content-between mb-2">
            <span class="text-danger justify-content-center align-items-center">${fileName}</span>
            <select class="mx-2" id="file-type-${currentIndex}-${fileName}" onchange="handleFileTypeChange(event, ${currentIndex}, '${fileName}')">
                <option value=""></option>
                <option value="fastq" ${fileType === "fastq" ? "selected" : ""}>fastq</option>
                <option value="bam" ${fileType === "bam" ? "selected" : ""}>bam</option>
                <option value="bam" ${fileType === "bai" ? "selected" : ""}>bai</option>
                <option value="vcf" ${fileType === "vcf" ? "selected" : ""}>vcf</option>
                <option value="others" ${fileType === "others" ? "selected" : ""}>Others</option>
            </select>
            <button type="button" class="btn btn-white" onclick="removeFileFromCard(${currentIndex},'${fileName}');">
                <span class="text-danger">X</span>
            </button>
        </div>`;
    }
    return fileHtml;
};

checkFileExtension = (fileName) => {
    const {FILE_TYPE} = require("./utils");
    let fileNames = fileName.split(".");
    const fileNamesLen = fileNames.length
    let lastExt = fileNames[fileNamesLen-1];
    let prevExt = fileNames[fileNamesLen-2];
    let fileTypes = ["fastq", "uncompressed_fastq", "bam", "bai", "vcf"];
    let fileType = "";
    for (let fileExt of fileTypes) {
        if (FILE_TYPE[fileExt].includes(`.${lastExt}`)) {
            fileType = fileExt;
            break;
        }
        if (FILE_TYPE[fileExt].includes(`.${prevExt}.${lastExt}`)) {
            fileType = fileExt;
            break;
        }
    }
    return fileType;
};

handleFileTypeChange = (event, currentIndex, fileName) => {
    let value = $(event.target).val();
    sampleCard[currentIndex].fileTypes[fileName] = value;
};
/* file drop events */
fileDrop = async (event) => {
    event.preventDefault();
    event.stopPropagation();
    let currentIndex = $(event.target).data("index");
    const {ipcRenderer} = require("electron");

    // setting background white
    let {files: _files, sampleOption: sampleId} = sampleCard[currentIndex] || {};
    if (!sampleId) {
        ipcRenderer.invoke("showErrorBox", {
            title: "Sample Id missing",
            message: `Please select or create a new sample for card ${currentIndex}.`,
        });
        return;
    }
    let patientFiles = [],
        fileNameChangeMessage = "We are going to update flowing file names as:\n",
        isUpdateFileName = false;
    let _updatedFileNames = sampleCard[currentIndex].updatedFileNames;
    $(`#drop-file-${currentIndex}`).css({backgroundColor: "#fff"});
    let files = event.dataTransfer.files,
        fileHtml = "";
    for (let file of files) {
        patientFiles.push(file);
        const fileName = file.name.replace(/ /g, '_');
        let _sampleId = fileName.split("-")[0];
        if (_sampleId !== sampleId) {
            _updatedFileNames[fileName] = `${sampleId}-${fileName}`;
            isUpdateFileName = true;
        }
        fileNameChangeMessage += `* ${file.name} => ${sampleId}-${fileName}\n`;
    }
    if (isUpdateFileName) {
        let result = await ipcRenderer.invoke("showFileNameChangeConformation", fileNameChangeMessage);
        if (result) {
            sampleCard[currentIndex].updatedFileNames = _updatedFileNames;
        } else {
            return;
        }
    }
    if (_files) {
        sampleCard[currentIndex].files = [..._files, ...patientFiles];
        patientFiles = [..._files, ...patientFiles];
    }
    for (let file of patientFiles) {
        const _fileName = file.name.replace(/ /g, '_');
        let fileName = _updatedFileNames[_fileName] ? _updatedFileNames[_fileName] : _fileName;
        isCorrectExtension = checkFileExtension(fileName);
        sampleCard[currentIndex].fileTypes[fileName] = isCorrectExtension;
        fileHtml += fileNameHtml(isCorrectExtension, fileName, currentIndex, isCorrectExtension);
    }
    sampleCard[currentIndex].files = patientFiles;
    $(`#file-names-${currentIndex}`).html(fileHtml);
    $(`#upload-btn-${currentIndex}`).removeClass("invisible");
};

fileDragOver = (event) => {
    event.preventDefault();
    event.stopPropagation();
};

fileDragEnter = (event) => {
    let currentIndex = $(event.target).data("index");
    $(`#drop-file-${currentIndex}`).css({backgroundColor: "#d48664"});
};

fileDragLeave = (event) => {
    let currentIndex = $(event.target).data("index");
    $(`#drop-file-${currentIndex}`).css({backgroundColor: "#fff"});
};

/* remove file from card */
removeFileFromCard = (currentIndex, fileName) => {
    let _files = sampleCard[currentIndex].files,
        fileHtml = "";
    let files = [];
    for (let file of _files) {
        const _fileName = file.name.replace(/ /g, '_');
        if (_fileName !== fileName) {
            let isCorrectExtension = checkFileExtension(_fileName);
            let fileType = sampleCard[currentIndex]?.fileTypes[_fileName];
            fileHtml += fileNameHtml(isCorrectExtension, _fileName, currentIndex, fileType);
            files.push(file);
        } else {
            delete sampleCard[currentIndex]?.fileTypes[fileName];
        }
    }
    sampleCard[currentIndex].files = files;
    $(`#file-names-${currentIndex}`).html(fileHtml);
};

/* file upload functions starts */
getFileBlob = function (url, cb) {
    var xhr = new XMLHttpRequest();
    xhr.open("GET", url);
    xhr.responseType = "blob";
    xhr.addEventListener("load", function () {
        cb(xhr.response);
    });
    xhr.send();
};

blobToFile = function (blob, name) {
    blob.lastModifiedDate = new Date();
    blob.name = name;
    return blob;
};

getFileObject = function (filePathOrUrl, fileName) {
    return new Promise((resolve, reject) => {
        try {
            getFileBlob(filePathOrUrl, function (blob) {
                resolve(blobToFile(blob, fileName));
            });
        } catch (error) {
            reject(error);
        }
    });
};

uploadFile = async () => {
    try {
        while (!fileUploadQueue.isEmpty) {
            const {file, patientId, fileUploadId, isFileResume, key, uploadId, currentPartIndex, fileName} = fileUploadQueue.dequeue();
            try {
                if (isFileResume) {
                    // call resume function.
                    await handleFileUploadResume(file, fileUploadId, key, uploadId, currentPartIndex);
                } else {
                    await handlefileUpload(file, patientId, fileUploadId, fileName);
                }
            } catch (error) {
                console.error("%c Line:441 🥑 error", "color:#3f7cff", error);
                cancelWithError("Error while process file uplaod", fileUploadId);
            }
        }
        isUploadFileInProgress = false;
    } catch (error) {
        cancelWithError("Error while looping queue");
        isUploadFileInProgress = false;
    }
};

getCurrentChunk = (file, chunk) => {
    const offset = chunk * chunkSize;
    return file.slice(offset, offset + chunkSize);
};

cancelWithError = async (errorMessage, fileUploadId) => {
    try {
        isCacelAvail[fileUploadId] = false;
        isUploading[fileUploadId] = true;
        updateIsUploading(isUploading);
        console.error("%c Line:413 🍏 errorMessage", "color:#ea7e5c", errorMessage);
        await canceldeleteFileUpload(fileUploadId, "error", keyObj[fileUploadId], errorMessage);
        if (keyObj[fileUploadId]) {
            delete keyObj[fileUploadId];
            updateKeyObj(keyObj);
        }
        $("#myTable").DataTable().ajax.reload();
    } catch (error) {
        console.error("%c 🥥 error", "color:#b03734", error.message);
        $("#myTable").DataTable().ajax.reload();
    }
};

handlePartUpload = async (file, partIndex, chunkLen, key, uplaodId, fileUploadId) => {
    const axios = require("axios");
    try {
        let prog = parseFloat(((partIndex + 1) * 100) / chunkLen).toFixed(2) + "%";
        let signedUploadResponse = await getSignedUrlsForAllPart(key, uplaodId, partIndex + 1);
        if (signedUploadResponse.data && signedUploadResponse.data.success && signedUploadResponse.data.data) {
            const fileData = getCurrentChunk(file, partIndex);
            let chunkUploadRes;
            try {
                if (navigator.onLine) {
                    cancelTokenSource = axios.CancelToken.source();
                    chunkUploadRes = await axios({
                        method: "PUT",
                        url: signedUploadResponse.data.data,
                        data: fileData,
                        headers: {"Content-Type": file.type},
                        cancelToken: cancelTokenSource.token,
                        maxContentLength: Infinity,
                        maxBodyLength: Infinity,
                        maxRedirects: 0,
                    });
                } else {
                    showNetworkError();
                }
            } catch (error) {
                console.error("%c 🍓 error", "color:#6ec1c2", error);
                if (error.code !== "ERR_CANCELED") {
                    throw error;
                }
            }
            if (navigator.onLine) {
                if (chunkUploadRes && chunkUploadRes.headers && chunkUploadRes.headers.etag) {
                    await createOrUpdateFileUpload({
                        id: fileUploadId,
                        file_progress: prog,
                        tag: chunkUploadRes.headers.etag.replace(/"/gi, ""),
                        currentIndex: partIndex + 1,
                    }).catch((error) => {
                        console.error("%c 🥃 error", "color:#ed9ec7", error);
                    });
                    $("#myTable").DataTable().ajax.reload();
                }
            } else {
                showNetworkError();
            }
        } else {
            throw new Error("Error while getting signed Url");
        }
    } catch (error) {
        throw error;
    }
};

handleCompleteTags = async (key, uplaodId, fileUploadId, s3filename) => {
    const {ipcRenderer} = require("electron");
    try {
        await completeSignedUrl(key, uplaodId, fileUploadId);
        await createOrUpdateFileUpload({
            id: fileUploadId,
            status: "COMPLETED",
            file_progress: "100%",
            remote_file_path: key,
        });
        $("#myTable").DataTable().ajax.reload();
        isUploading[fileUploadId] = true;
        updateIsUploading(isUploading);
        delete keyObj[fileUploadId];
        updateKeyObj(keyObj);
        ipcRenderer.invoke("showNotificaction", {title: "File Upload", body: `${s3filename} is uploaded.`});
    } catch (error) {
        console.error("%c 🍖 error", "color:#3f7cff", error);
        createOrUpdateFileUpload({
            id: fileUploadId,
            status: "COMPLETED_WITH_ERROR",
            file_progress: "100%",
        })
            .then(() => {
                $("#myTable").DataTable().ajax.reload();
                isUploading[fileUploadId] = true;
                updateIsUploading(isUploading);
                canceldeleteFileUpload(fileUploadId, "COMPLETED_WITH_ERROR", keyObj[fileUploadId], error.message);
                delete keyObj[fileUploadId];
                updateKeyObj(keyObj);
                ipcRenderer.invoke("showNotificaction", {title: "File Upload", body: `${s3filename} is failed to upload.`});
            })
            .catch((error) => {
                console.error("%c 🥃 error", "color:#ed9ec7", error);
            });
    }
};

handlefileUpload = async (file, patientId, fileUploadId, fileName) => {
    const {getCurrentDateTime} = require("./utils");
    try {
        const pathfu = require("path");
        let s3filename = fileName ? fileName : pathfu.basename(file.path);
        const key = `augmet_uploader/${patientId}_${getCurrentDateTime()}/${s3filename}`;
        const chunkLen = Math.ceil(file.size / chunkSize, chunkSize);
        //step-1 initiate multipart upload
        if (navigator.onLine) {
            await createOrUpdateFileUpload({
                id: fileUploadId,
                status: "IN_PROGRESS",
                file_progress: "0%",
            });
            $("#myTable").DataTable().ajax.reload();
            const intialResponse = await initiateMultipartUpload(key);
            if (intialResponse.data && intialResponse.data.success && intialResponse.data.data) {
                let uplaodId = intialResponse.data.data.UploadId;
                await createOrUpdateFileUpload({
                    id: fileUploadId,
                    aws_upload_id: uplaodId,
                    aws_key: key,
                });
                keyObj[fileUploadId] = {key, uplaodId};
                for (let partIndex = 0; partIndex < chunkLen; partIndex++) {
                    if (navigator.onLine) {
                        if (!isCacelAvail[fileUploadId]) {
                            return "Cancled file Upload";
                        }
                        await handlePartUpload(file, partIndex, chunkLen, key, uplaodId, fileUploadId);
                    } else {
                        showNetworkError();
                    }
                }

                // calling complete api with tags.
                if (isCacelAvail[fileUploadId]) {
                    await handleCompleteTags(key, uplaodId, fileUploadId, s3filename);
                }
            } else {
                throw new Error("Error while initiate file upload");
            }
        } else {
            showNetworkError();
        }
    } catch (error) {
        console.error("%c 🍤 error", "color:#ed9ec7", error);
        cancelWithError("Error while process file uplaod", fileUploadId);
    }
};

handleFileUploadResume = async (file, fileUploadId, key, uplaodId, currentPartIndex, fileName) => {
    currentPartIndex = parseInt(currentPartIndex) || 0;
    try {
        const chunkLen = Math.ceil(file.size / chunkSize, chunkSize);
        if (navigator.onLine) {
            await createOrUpdateFileUpload({
                id: fileUploadId,
                status: "IN_PROGRESS",
                updateStatus: true,
            });
            $("#myTable").DataTable().ajax.reload();
            for (let partIndex = currentPartIndex; partIndex < chunkLen; partIndex++) {
                if (navigator.onLine) {
                    if (!isCacelAvail[fileUploadId]) {
                        return "Cancled file Upload";
                    }
                    await handlePartUpload(file, partIndex, chunkLen, key, uplaodId, fileUploadId);
                } else {
                    showNetworkError();
                }
            }
            // calling complete api with tags.
            if (isCacelAvail[fileUploadId]) {
                await handleCompleteTags(key, uplaodId, fileUploadId, key);
            }
        } else {
            showNetworkError();
        }
    } catch (error) {
        console.error("%c Line:522 🍯 error", "color:#ea7e5c", error);
        cancelWithError("Error while process file upload", fileUploadId);
    }
};

/* file upload functions end */

handleFileUpload = async (currentIndex) => {
    const pathfu = require("path");
    let {patientOption: patientId, visitOption: visitId, sampleOption: sampleId, files, updatedFileNames} = sampleCard[currentIndex];
    $(`#patientCardProcessing-${currentIndex}`).removeClass("d-none");
    if (patientId === "loading" || patientId === "") {
        const {ipcRenderer} = require("electron");
        ipcRenderer.invoke("showErrorBox", {
            title: "File Upload",
            message: `Patient is not selected for card ${currentIndex}.`,
        });
    }

    if (visitId === "loading" || visitId === "") {
        const {ipcRenderer} = require("electron");
        ipcRenderer.invoke("showErrorBox", {
            title: "File Upload",
            message: `Visit is not selected for card ${currentIndex}.`,
        });
    }

    if (sampleId === "loading" || sampleId === "") {
        const {ipcRenderer} = require("electron");
        ipcRenderer.invoke("showErrorBox", {
            title: "File Upload",
            message: `Sample is not selected for card ${currentIndex}.`,
        });
    }
    let uploadedFileNames = [],
        notUploadFileNames = [];
    for (let file of files) {
        const _fileName = file.name.replace(/ /g, '_');
        let fileName = updatedFileNames[_fileName] ? updatedFileNames[_fileName] : _fileName;
        let fileType = checkFileExtension(fileName);
        let isUncompressedFast = false;
        if(fileType === "uncompressed_fastq"){
            fileType = "";
            isUncompressedFast=true;
        }
        if (!fileType) {
            let _fileType = sampleCard[currentIndex]?.fileTypes[fileName];
            if (_fileType === "others") {
                fileType = _fileType;
            }
        }
        if (fileType) {
            if (localStorage.getItem("org_id")) {
                try {
                    let result = await createOrUpdateFileUpload({
                        file_name: fileName,
                        original_file_name: pathfu.basename(file.path),
                        local_file_path: file.path,
                        org_id: localStorage.getItem("org_id"),
                        patient_id: patientId,
                        sample_id: sampleId || "",
                        visit_id: visitId || "",
                        file_type: fileType,
                        file_size: file.size,
                    });
                    $("#myTable").DataTable().ajax.reload();
                    if (result.data.success) {
                        const fileUploadId = result.data.data._id;
                        isUploading[fileUploadId] = false;
                        updateIsUploading(isUploading);
                        isCacelAvail[fileUploadId] = true;
                        fileUploadQueue.enqueue({file, patientId, fileUploadId, fileName});
                    }
                } catch (error) {
                    console.error("%c Line:710 🌭 err-file-upload", "color:#fca650", error.message);
                    const {ipcRenderer} = require("electron");
                    let message = error?.response?.message;
                    if (!message) message = "Error while creating patient Visits";
                    ipcRenderer.invoke("showErrorBox", {title: "File Upload Error", message});
                }
            }
            uploadedFileNames.push(`<p class="text-success font-weight-bold">* ${fileName}</p>`);
        } else {
            notUploadFileNames.push(`<p class="text-danger font-weight-bold">* ${_fileName} ${isUncompressedFast ? " Please compress file and upload.": ""}</p>`);
        }
    }

    if (!isUploadFileInProgress) {
        isUploadFileInProgress = true;
        uploadFile();
    }

    let uploadMessage = `<h5 class="mt-5">For status update of files added to queue visit "File List" Tab</h5>`;
    if (uploadedFileNames && uploadedFileNames.length) {
        uploadMessage += "<h6>Files succesfully added to queue.</h6>";
        uploadMessage += uploadedFileNames.join("");
    }
    if (notUploadFileNames && notUploadFileNames.length) {
        uploadMessage += `<h6>File Not added to queue due to file type changes:</h6>`;
        uploadMessage += notUploadFileNames.join("");
    }
    $(`#patientCardProcessing-${currentIndex}`).html(uploadMessage);
    $(`#close-btn-${currentIndex}`).addClass("btn-outline-danger");
    $(`#close-btn-${currentIndex}`).removeClass("btn-light");
};
