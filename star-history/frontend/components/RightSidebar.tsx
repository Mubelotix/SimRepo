/* eslint-disable @next/next/no-img-element */
import React from "react"
import { SketchMailboxIcon } from "./SketchIcons"

const RightSidebar: React.FC = () => {
    return (
        <div className="sidebar-sticky items-start">
            <div className="w-full px-2 pt-4 flex flex-col justify-start items-start">
                <a
                    href="mailto:mubelotix@gmail.com?subject=I'm interested in promoting my project on star-history.dera.page"
                    target="_blank"
                    className="w-full p-2 text-center bg-gray-50 text-xs leading-6 text-gray-400 rounded hover:underline hover:text-blue-600"
                >
                    <SketchMailboxIcon size={14} /> Promote your project
                </a>
            </div>
        </div>
    )
}

export default RightSidebar
