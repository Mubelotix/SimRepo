import React, { useState } from "react";
import GitHubStarButton from "./GitHubStarButton";
import TokenSettingDialog from "./TokenSettingDialog";
import Link from "next/link";
import { useAppStore } from "../store";
import { SketchLightBulbIcon } from "./SketchIcons";

const Header: React.FC = () => {
  const store = useAppStore()
  const [showSetTokenDialog, setShowSetTokenDialog] = useState(false);
  const [showDropMenu, setShowDropMenu] = useState(false);

  const headerText = store.token ? "Edit access token" : "Add access token";

  return (
    <>
      {showSetTokenDialog && (
        <TokenSettingDialog
          onClose={() => setShowSetTokenDialog(false)}
          tokenCache={false}
        />
      )}

        <header className="w-full h-14 shrink-0 flex flex-row justify-center items-center bg-dark text-light">
          <div className="w-full h-full flex flex-row justify-between items-center px-4">
            <div className="h-full bg-dark flex flex-row justify-start items-center">
              <Link href="/" className="header-link px-3">
                <img className="w-7 h-auto logo-spin" src="/assets/logo-icon.png" alt="Logo" />
              </Link>
              <a href="https://blog.dera.page" target="_blank" rel="noopener noreferrer" className="header-link text-base">
                <span className="text-white -2">Blog</span>
              </a>
              <a href="https://github.com/Mubelotix/SimRepo" target="_blank" rel="noopener noreferrer" className="header-link text-base">
                <span className="text-white -2">Extension</span>
              </a>
              <a href="https://github.com/sponsors/Mubelotix" target="_blank" rel="noopener noreferrer" className="header-link text-base">
                <span className="text-white -2">Sponsor</span>
              </a>
              <span
                className="header-link cursor-pointer text-white text-base"
                onClick={() => setShowSetTokenDialog(true)}
              >
                {headerText}
              </span>
            </div>
            <div className="hidden md:flex flex-row justify-center items-center">
              <a href="https://blog.dera.page" target="_blank" rel="noopener noreferrer" className="flex flex-row items-center text-base px-2 hover:underline">
                <span className="text-white flex items-center gap-1"><SketchLightBulbIcon /> How to use this site</span>
              </a>
            </div>
            <div className="h-full hidden md:flex flex-row justify-end items-center px-3">
              <GitHubStarButton />
            </div>

            <div className="h-full flex md:hidden flex-row justify-end items-center">
              <button
                aria-label="Toggle menu"
                aria-expanded={showDropMenu}
                className="relative h-full w-10 px-3 flex flex-row justify-center items-center cursor-pointer font-semibold text-light hover:bg-zinc-800 bg-transparent border-none"
                onClick={() => setShowDropMenu((prev) => !prev)}
              >
                <span className={`w-4 transition-all h-px bg-light absolute top-1/2 ${showDropMenu ? "w-6 rotate-45" : "-mt-1"}`}></span>
                <span className={`w-4 transition-all h-px bg-light absolute top-1/2 ${showDropMenu ? "hidden" : ""}`}></span>
                <span className={`w-4 transition-all h-px bg-light absolute top-1/2 ${showDropMenu ? "w-6 -rotate-45" : "mt-1"}`}></span>
              </button>
            </div>
          </div>
        </header>
        <div className={`w-full h-auto py-2 flex md:hidden flex-col justify-start items-start shadow-lg border-b ${showDropMenu ? "flex" : "hidden"}`}>
          <span
            className="h-12 px-3 text-base w-full flex flex-row justify-start items-center cursor-pointer font-semibold text-dark mr-2 hover:bg-gray-100 hover:text-blue-500"
            onClick={() => setShowSetTokenDialog(true)}
          >
            {headerText}
          </span>
          <span className="h-12 text-base px-3 w-full flex flex-row justify-start items-center text-dark">
            <GitHubStarButton />
          </span>
        </div>
    </>
  );
};

export default Header;
