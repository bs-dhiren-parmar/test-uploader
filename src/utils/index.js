const checkFunction = () => {
    const apiKey = localStorage.getItem("apiKey");
    const isUserActive = localStorage.getItem("isUserActive");
    let file = "";
    if (apiKey && isUserActive) {
        file = "Pages/uploader.html";
    } else {
        file = "Pages/login.html";
    }
    $("#main").load(file);
};

const objectToQueryString = (objectData) => {
    return Object.keys(objectData)
        .map((key) => {
            if (typeof objectData[key] === "object") {
                return key + "=" + JSON.stringify(objectData[key]);
            } else {
                return key + "=" + objectData[key];
            }
        })
        .join("&");
};

const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const getTwodigitFormate = (data) => {
    let result = data > 9 ? data : "0" + data;
    return result;
};

const dateAndTimeFormate = (dateObject) => {
    if (dateObject) {
        let date = getTwodigitFormate(dateObject.getDate());
        let hour = getTwodigitFormate(dateObject.getHours());
        let minutes = getTwodigitFormate(dateObject.getMinutes());
        let seconds = getTwodigitFormate(dateObject.getSeconds());
        let newDateFormate = date + "-" + MONTH[dateObject.getMonth()] + "-" + dateObject.getFullYear() + " " + hour + ":" + minutes + ":" + seconds;
        return newDateFormate;
    } else {
        return null;
    }
};

const getLocalDateTime = (dateAndTime) => {
    if (dateAndTime) {
        let dateObject = new Date(dateAndTime);
        let newDateFormate = dateAndTimeFormate(dateObject);
        return newDateFormate;
    }
};

function getCurrentDateTime() {
    let date_ob = new Date();
    let date = ("0" + date_ob.getDate()).slice(-2);
    let month = ("0" + (date_ob.getMonth() + 1)).slice(-2);
    let year = ("0" + date_ob.getFullYear()).slice(-2);
    let hours = date_ob.getHours();
    let minutes = date_ob.getMinutes();
    let seconds = date_ob.getSeconds();

    // prints date & time in YYYY-MM-DD HH:MM:SS format
    return `${month}${date}${year}_${hours}${minutes}${seconds}`;
}

const FILE_TYPE = {
    fastq: [".fq.gz", ".fastq.gz"],
    bam: [".bam"],
    bai: [".bai", ".bam.bai"],
    vcf: [".vcf", ".vcf.idx", ".vcf.gz"],
    uncompressed_fastq: [".fq", ".fastq"]
};

const VERSION = "1.0.0";

module.exports = {
    checkFunction,
    objectToQueryString,
    getLocalDateTime,
    getCurrentDateTime,
    FILE_TYPE,
    VERSION
};
