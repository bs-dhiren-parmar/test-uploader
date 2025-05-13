const axios = require("axios");

const authenticateUser = async (email, apiKey, baseUrl) => {
    try {
        return await axios({
            url: `${baseUrl}/api/users/authenticate/by-api-key`,
            method: "post",
            data: {
                email,
                apiKey,
            },
        });
    } catch (error) {
        throw error;
    }
};

const createOrUpdateFileUpload = async (data) => {
    const API_URL = localStorage.getItem("API_URL");
    let url = `${API_URL}/api/file-upload`;
    const apiKey = localStorage.getItem("apiKey");
    return axios({
        method: "POST",
        url,
        headers: {
            "api-key": apiKey,
        },
        data,
    });
};

const getPatients = async () => {
    const API_URL = localStorage.getItem("API_URL");
    let url = `${API_URL}/api/patients/patient`;
    const apiKey = localStorage.getItem("apiKey");
    return axios({
        method: "GET",
        url,
        headers: {
            "api-key": apiKey,
        },
    });
};
const getPatientById = (patient_id) => {
    const API_URL = localStorage.getItem("API_URL");
    let url = `${API_URL}/api/patients/visits/${patient_id}`;
    const apiKey = localStorage.getItem("apiKey");
    return axios({
        method: "GET",
        url,
        headers: {
            "api-key": apiKey,
        },
    });
};

const getSignedUrl = (key, mimetype) => {
    const API_URL = localStorage.getItem("API_URL");
    let url = `${API_URL}/api/file-upload/pre-signed-url?key=${key}&mimetype=${mimetype}`;
    const apiKey = localStorage.getItem("apiKey");
    return axios({
        method: "GET",
        url,
        headers: {
            "api-key": apiKey,
        },
    });
};

const initiateMultipartUpload = (key) => {
    const API_URL = localStorage.getItem("API_URL");
    let url = `${API_URL}/api/file-upload/intiate-multipart-upload?key=${key}`;
    const apiKey = localStorage.getItem("apiKey");
    return axios({
        method: "GET",
        url,
        headers: {
            "api-key": apiKey,
        },
    });
};

const getSignedUrlsForAllPart = (key, uploadId, partIndex) => {
    const API_URL = localStorage.getItem("API_URL");
    let url = `${API_URL}/api/file-upload/genrate-signed-urls?key=${key}&uploadId=${uploadId}&PartNumber=${partIndex}`;
    const apiKey = localStorage.getItem("apiKey");
    return axios({
        method: "GET",
        url,
        headers: {
            "api-key": apiKey,
        },
    });
};

const completeSignedUrl = (key, uploadId, fileUploadId) => {
    const API_URL = localStorage.getItem("API_URL");
    let url = `${API_URL}/api/file-upload/complete-signed-upload`;
    const apiKey = localStorage.getItem("apiKey");
    return axios({
        method: "POST",
        url,
        headers: {
            "api-key": apiKey,
        },
        data: {
            key,
            uploadId,
            fileUploadId,
        },
    });
};

const canceldeleteFileUpload = (id, status, uploadData, errorMessage) => {
    const API_URL = localStorage.getItem("API_URL");
    let url = `${API_URL}/api/file-upload/cancel-delete/${id}`;
    const apiKey = localStorage.getItem("apiKey");
    return axios({
        method: "POST",
        url,
        headers: {
            "api-key": apiKey,
        },
        data: {
            status,
            key: uploadData && uploadData.key ? uploadData.key : null,
            uploadId: uploadData && uploadData.uplaodId ? uploadData.uplaodId : null,
            errorMessage
        },
    });
};
const cancelAllFileUpload = (API_URL, apiKey, ids, keyObj) => {
    let url = `${API_URL}/api/file-upload/cancel-all`;
    return axios({
        method: "POST",
        url,
        headers: {
            "api-key": apiKey,
        },
        data: {
            ids,
            keyObj,
        },
    });
};

const addSampleId = (API_URL, apiKey, patientId, visitId, sampleId) => {
    let url = `${API_URL}/api/patients/add-sample-id`;
    return axios({
        method: "POST",
        url,
        headers: {
            "api-key": apiKey,
        },
        data: {
            patientId,
            visitId,
            sampleId,
        },
    });
};

module.exports = {
    authenticateUser,
    createOrUpdateFileUpload,
    getPatients,
    getPatientById,
    getSignedUrl,
    initiateMultipartUpload,
    getSignedUrlsForAllPart,
    completeSignedUrl,
    canceldeleteFileUpload,
    cancelAllFileUpload,
    addSampleId,
};
