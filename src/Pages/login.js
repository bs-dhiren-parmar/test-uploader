$(document).ready(function () {
    const {authenticateUser} = require("./utils/apiServerics");

    submitbtn = document.querySelector("#submitbtn");

    const validateEmail = (email) => {
        return String(email)
            .toLowerCase()
            .match(
                /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
            );
    };

    const validateUrl = (url) => {
        const urlRegex = new RegExp("https?://(?:w{1,3}.)?[^s.]+(?:.[a-z]+)*(?::d+)?(?![^<]*(?:</w+>))", "gm");
        const ipUrlRegex = new RegExp("^((https?://)|(www.))(?:([a-zA-Z]+)|(d+.d+.d+.d+)):d{4}$", "gm");
        return urlRegex.test(url) ? true : ipUrlRegex.test(url);
    };

    const checkfields = (email, apiKey, baseUrl) => {
        const emailError = document.querySelector("#email-error"),
            apiKeyError = document.querySelector("#api-key-error"),
            baseUrlError = document.querySelector("#base-url-error");
        let result = true;
        if (email) {
            if (!validateEmail(email)) {
                emailError.innerText = "Please provide valid email";
                result = false;
            } else {
                emailError.innerText = "";
            }
        } else {
            emailError.innerText = "Email is required";
            result = false;
        }
        if (!apiKey) {
            apiKeyError.innerText = "Api Key is required";
            result = false;
        } else {
            apiKeyError.innerText = "";
        }
        if (!baseUrl) {
            baseUrlError.innerText = "Base Url is required";
            result = false;
        } else {
            if (validateUrl(baseUrl)) {
                baseUrlError.innerText = "";
            } else {
                baseUrlError.innerText = "Please provide valid Url";
                result = false;
            }
        }
        return result;
    };

    submitbtn.addEventListener("click", async (event) => {
        const {ipcRenderer} = require("electron");
        event.preventDefault();
        const email = document.querySelector("#email").value,
            apiKey = document.querySelector("#apiKey").value, 
            isKeepLoginIn = !!$(`#keepSignedIn:checked`).length;
        let baseUrl = document.querySelector("#baseUrl").value;
        if (baseUrl.endsWith("/")) baseUrl = baseUrl.slice(0, -1);
        if (navigator.onLine) {
            const result = checkfields(email, apiKey, baseUrl);
            if (result) {
                try {
                    let {data: loginResponse} = await authenticateUser(email, apiKey, baseUrl);
                    if (loginResponse.success) {
                        localStorage.setItem("apiKey", apiKey);
                        localStorage.setItem("API_URL", baseUrl);
                        localStorage.setItem("email", email);
                        localStorage.setItem("isKeepLoginIn", isKeepLoginIn);
                        localStorage.setItem("isUserActive", true);
                        let userName = loginResponse.data.user.first_name;
                        if(loginResponse.data.user.lastName){
                            userName += ` ${loginResponse.data.user.last_name}`;
                        }
                        localStorage.setItem("userName", userName);

                        localStorage.setItem(
                            "org_id",
                            loginResponse.data.user && loginResponse.data.user.roles[0] && loginResponse.data.user.roles[0].org_id
                                ? loginResponse.data.user.roles[0].org_id
                                : ""
                        );
                        ipcRenderer.invoke("keepLoginDetails", {apiKey, baseUrl});
                        checkFunction();
                    } else {
                        ipcRenderer.invoke("showErrorBox", {title: "Login Credentials", message: "Credentails Provided are not correct"});
                    }
                } catch (error) {
                    ipcRenderer.invoke("showErrorBox", {title: "Login Credentials", message: "Credentails Provided are not correct"});
                }
            }
        } else {
            ipcRenderer.invoke("showErrorBox", {title: "Network Error", message: "Please connect to network"});
        }
    });

    const localUrl = localStorage.getItem("API_URL", baseUrl);
    const localEmail = localStorage.getItem("email", email);
    $("#email").val(localEmail);
    $("#baseUrl").val(localUrl);
});
