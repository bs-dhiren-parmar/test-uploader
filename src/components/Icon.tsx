import React from "react";

// Import all SVG icons
import logoutIcon from "../assets/icons/logout.svg";
import userPlusIcon from "../assets/icons/user-plus.svg";
import augmetLogoIcon from "../assets/icons/augmet-logo.svg";
import infoIcon from "../assets/icons/info.svg";
import downloadIcon from "../assets/icons/download.svg";
import trashIcon from "../assets/icons/trash.svg";
import refreshIcon from "../assets/icons/refresh.svg";
import closeIcon from "../assets/icons/close.svg";
import cloudUploadIcon from "../assets/icons/cloud-upload.svg";
import fileUploadIcon from "../assets/icons/file-upload.svg";

// Icon name to source mapping
const icons = {
    logout: logoutIcon,
    "user-plus": userPlusIcon,
    "augmet-logo": augmetLogoIcon,
    info: infoIcon,
    download: downloadIcon,
    trash: trashIcon,
    refresh: refreshIcon,
    close: closeIcon,
    "cloud-upload": cloudUploadIcon,
    "file-upload": fileUploadIcon,
} as const;

// Color variants
export type IconColor = "white" | "black" | "primary" | "secondary" | "danger" | "success" | "inherit";

// CSS filter values to transform black SVGs to target colors
const colorFilters: Record<IconColor, string> = {
    inherit: "none",
    white: "brightness(0) invert(1)",
    black: "brightness(0)",
    primary: "brightness(0) saturate(100%) invert(37%) sepia(93%) saturate(1352%) hue-rotate(226deg) brightness(102%) contrast(93%)", // ~#5D57F4
    secondary: "brightness(0) saturate(100%) invert(53%) sepia(6%) saturate(617%) hue-rotate(182deg) brightness(92%) contrast(87%)", // ~#6c757d
    danger: "brightness(0) saturate(100%) invert(27%) sepia(51%) saturate(2878%) hue-rotate(346deg) brightness(104%) contrast(97%)", // ~#dc3545
    success: "brightness(0) saturate(100%) invert(52%) sepia(59%) saturate(459%) hue-rotate(93deg) brightness(94%) contrast(88%)", // ~#28a745
};

export type IconName = keyof typeof icons;

interface IconProps {
    name: IconName;
    size?: number;
    width?: number;
    height?: number;
    color?: IconColor;
    className?: string;
    title?: string;
}

const Icon: React.FC<IconProps> = ({ name, size, width, height, color = "inherit", className = "", title }) => {
    const iconSrc = icons[name];

    // Use size if provided, otherwise use width/height individually
    const iconWidth = size ?? width ?? 24;
    const iconHeight = size ?? height ?? 24;

    // Get filter for color transformation
    const filter = colorFilters[color];

    return (
        <img
            src={iconSrc}
            alt={title || name}
            width={iconWidth}
            height={iconHeight}
            className={className}
            title={title}
            style={{
                display: "inline-block",
                verticalAlign: "middle",
                filter: filter !== "none" ? filter : undefined,
            }}
        />
    );
};

export default Icon;

