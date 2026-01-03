import React, { useState, useRef, useEffect, ReactNode } from "react";
import "../styles/tooltip.css";

type TooltipPosition = "top" | "bottom" | "left" | "right";

interface TooltipProps {
    content: string;
    children: ReactNode;
    position?: TooltipPosition;
    delay?: number;
}

const Tooltip: React.FC<TooltipProps> = ({
    content,
    children,
    position = "top",
    delay = 200,
}) => {
    const [isVisible, setIsVisible] = useState(false);
    const [actualPosition, setActualPosition] = useState<TooltipPosition>(position);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const tooltipRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLSpanElement>(null);

    const showTooltip = () => {
        timeoutRef.current = setTimeout(() => {
            setIsVisible(true);
        }, delay);
    };

    const hideTooltip = () => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
        setIsVisible(false);
    };

    // Adjust position if tooltip would overflow viewport
    useEffect(() => {
        if (isVisible && tooltipRef.current && triggerRef.current) {
            const tooltipRect = tooltipRef.current.getBoundingClientRect();
            const triggerRect = triggerRef.current.getBoundingClientRect();
            let newPosition = position;

            // Check if tooltip overflows and adjust
            if (position === "top" && tooltipRect.top < 8) {
                newPosition = "bottom";
            } else if (position === "bottom" && tooltipRect.bottom > window.innerHeight - 8) {
                newPosition = "top";
            } else if (position === "left" && tooltipRect.left < 8) {
                newPosition = "right";
            } else if (position === "right" && tooltipRect.right > window.innerWidth - 8) {
                newPosition = "left";
            }

            if (newPosition !== actualPosition) {
                setActualPosition(newPosition);
            }
        }
    }, [isVisible, position, actualPosition]);

    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    return (
        <span
            className="tooltip-wrapper"
            onMouseEnter={showTooltip}
            onMouseLeave={hideTooltip}
            onFocus={showTooltip}
            onBlur={hideTooltip}
            ref={triggerRef}
        >
            {children}
            {isVisible && (
                <div
                    ref={tooltipRef}
                    className={`tooltip tooltip-${actualPosition}`}
                    role="tooltip"
                >
                    <span className="tooltip-content">{content}</span>
                    <span className="tooltip-arrow" />
                </div>
            )}
        </span>
    );
};

export default Tooltip;

