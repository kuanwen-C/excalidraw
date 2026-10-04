import clsx from "clsx";
import debounce from "lodash.debounce";
import { Fragment, memo, useEffect, useMemo, useRef, useState } from "react";

import { CLASSES, EVENT, FONT_FAMILY, FRAME_STYLE } from "@excalidraw/common";

import {
  getCommonBounds,
  isElementCompletelyInViewport,
} from "@excalidraw/element";

import { KEYS, randomInteger, addEventListener } from "@excalidraw/common";

import { newTextElement } from "@excalidraw/element";
import { isTextElement, isFrameLikeElement } from "@excalidraw/element";

import { getDefaultFrameName } from "@excalidraw/element/frame";

import { atom, useAtom } from "../editor-jotai";

import { useStable } from "../hooks/useStable";
import { t } from "../i18n";
import { searchDrawing } from "../search";

import { useApp, useExcalidrawAppState, useExcalidrawSetAppState } from "./App";
import { Button } from "./Button";
import { TextField } from "./TextField";
import {
  collapseDownIcon,
  upIcon,
  searchIcon,
  frameToolIcon,
  TextIcon,
} from "./icons";

import "./SearchMenu.scss";

import type {
  SearchMatchItem,
  SearchMatches,
  SearchQuery,
  SearchScope,
} from "../search";

const searchQueryAtom = atom<string>("");
export const searchItemInFocusAtom = atom<number | null>(null);

const SEARCH_DEBOUNCE = 350;

export const SearchMenu = () => {
  const app = useApp();
  const setAppState = useExcalidrawSetAppState();
  const { selectedElementIds, zoom } = useExcalidrawAppState();
  const [scope, setScope] = useState<SearchScope>({ type: "all" });
  const [matchCase, setMatchCase] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);

  const [inputValue, setInputValue] = useAtom(searchQueryAtom);
  const searchQuery = inputValue.trim() as SearchQuery;

  const [isSearching, setIsSearching] = useState(false);

  const [searchMatches, setSearchMatches] = useState<SearchMatches>({
    nonce: null,
    items: [],
  });
  const [focusIndex, setFocusIndex] = useAtom(searchItemInFocusAtom);
  const stableSearchState = useStable({ searchMatches, focusIndex });
  const sceneNonce = app.scene.getSceneNonce();
  const frames = app.scene
    .getNonDeletedFramesLikes()
    .filter((frame) => !frame.isDeleted);
  const selection = scope.type === "selection" ? selectedElementIds : undefined;
  const lastNavigatedMatchRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const runSearch = () => {
      if (cancelled) {
        return;
      }
      const items = searchDrawing(
        app.scene.getNonDeletedElements(),
        searchQuery,
        zoom.value,
        { scope, selectedElementIds: selection, matchCase },
      );
      const previousMatch =
        stableSearchState.focusIndex === null
          ? null
          : stableSearchState.searchMatches.items[stableSearchState.focusIndex];
      const preservedIndex = previousMatch
        ? items.findIndex(
            (match) =>
              match.element.id === previousMatch.element.id &&
              match.index === previousMatch.index &&
              match.matchedText === previousMatch.matchedText,
          )
        : -1;
      const visibleIds = new Set(
        app.visibleElements.map((element) => element.id),
      );
      const visibleIndex = items.findIndex((match) =>
        visibleIds.has(match.element.id),
      );
      setSearchMatches({ nonce: randomInteger(), items });
      setFocusIndex(
        preservedIndex >= 0
          ? preservedIndex
          : visibleIndex >= 0
          ? visibleIndex
          : items.length
          ? 0
          : null,
      );
      setIsSearching(false);
    };

    // Each menu owns its pending work. Changes and unmount cancel the old request.
    const pendingSearch = debounce(runSearch, SEARCH_DEBOUNCE);
    setIsSearching(true);
    if (searchQuery) {
      pendingSearch();
    } else {
      runSearch();
    }
    return () => {
      cancelled = true;
      pendingSearch.cancel();
    };
  }, [
    searchQuery,
    scope,
    matchCase,
    selection,
    sceneNonce,
    zoom.value,
    app,
    setFocusIndex,
    stableSearchState,
  ]);

  const goToNextItem = () => {
    if (searchMatches.items.length > 0) {
      setFocusIndex((focusIndex) => {
        if (focusIndex === null) {
          return 0;
        }

        return (focusIndex + 1) % searchMatches.items.length;
      });
    }
  };

  const goToPreviousItem = () => {
    if (searchMatches.items.length > 0) {
      setFocusIndex((focusIndex) => {
        if (focusIndex === null) {
          return 0;
        }

        return focusIndex - 1 < 0
          ? searchMatches.items.length - 1
          : focusIndex - 1;
      });
    }
  };

  useEffect(() => {
    const focusedId =
      focusIndex === null
        ? null
        : searchMatches.items[focusIndex]?.element.id ?? null;
    setAppState({
      searchMatches: searchMatches.items.length
        ? {
            focusedId,
            matches: searchMatches.items.map((match, index) => ({
              id: match.element.id,
              focus: index === focusIndex,
              matchedLines: match.matchedLines,
            })),
          }
        : null,
    });
  }, [searchMatches, focusIndex, setAppState]);

  useEffect(() => {
    if (searchMatches.items.length > 0 && focusIndex !== null) {
      const match = searchMatches.items[focusIndex];

      if (match) {
        const matchKey = JSON.stringify([
          match.element.id,
          match.index,
          match.matchedText,
        ]);
        // Geometry refreshes must not undo a user's manual pan or zoom.
        if (lastNavigatedMatchRef.current === matchKey) {
          return;
        }
        lastNavigatedMatchRef.current = matchKey;
        const zoomValue = app.state.zoom.value;

        const matchAsElement = newTextElement({
          text: match.matchedText,
          x: match.element.x + (match.matchedLines[0]?.offsetX ?? 0),
          y: match.element.y + (match.matchedLines[0]?.offsetY ?? 0),
          width: match.matchedLines[0]?.width,
          height: match.matchedLines[0]?.height,
          fontSize: isFrameLikeElement(match.element)
            ? FRAME_STYLE.nameFontSize
            : match.element.fontSize,
          fontFamily: isFrameLikeElement(match.element)
            ? FONT_FAMILY.Assistant
            : match.element.fontFamily,
        });

        const FONT_SIZE_LEGIBILITY_THRESHOLD = 14;

        const fontSize = matchAsElement.fontSize;
        const isTextTiny =
          fontSize * zoomValue < FONT_SIZE_LEGIBILITY_THRESHOLD;

        if (
          !isElementCompletelyInViewport(
            [matchAsElement],
            app.canvas.width / app.ownerWindow.devicePixelRatio,
            app.canvas.height / app.ownerWindow.devicePixelRatio,
            {
              offsetLeft: app.state.offsetLeft,
              offsetTop: app.state.offsetTop,
              scrollX: app.state.scrollX,
              scrollY: app.state.scrollY,
              zoom: app.state.zoom,
            },
            app.scene.getNonDeletedElementsMap(),
            app.viewport.getOffsets(),
          ) ||
          isTextTiny
        ) {
          // tiny, illegible text fills the viewport so it becomes readable;
          // otherwise just fit the match into view (capped at 100%)
          const behavior =
            isTextTiny && fontSize < FONT_SIZE_LEGIBILITY_THRESHOLD
              ? "contain"
              : "scale-down";

          app.viewport.setViewport({
            target: getCommonBounds([matchAsElement]),
            fit: behavior,
            animation: { duration: 300 },
            offsets: { ui: true },
          });
        }
      }
    } else {
      lastNavigatedMatchRef.current = null;
    }
  }, [focusIndex, searchMatches, app]);

  useEffect(() => {
    return () => {
      setFocusIndex(null);
      setAppState({
        searchMatches: null,
      });
    };
  }, [setAppState, setFocusIndex]);

  const stableState = useStable({
    goToNextItem,
    goToPreviousItem,
    searchMatches,
  });

  useEffect(() => {
    const eventHandler = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        event.key === KEYS.ESCAPE &&
        !app.state.openDialog &&
        !app.state.openPopup
      ) {
        event.preventDefault();
        event.stopPropagation();
        setAppState({
          openSidebar: null,
        });
        return;
      }

      if (event[KEYS.CTRL_OR_CMD] && event.key === KEYS.F) {
        event.preventDefault();
        event.stopPropagation();

        if (app.state.openDialog) {
          return;
        }

        if (!searchInputRef.current?.matches(":focus")) {
          if (app.state.openDialog) {
            setAppState({
              openDialog: null,
            });
          }
          searchInputRef.current?.focus();
          searchInputRef.current?.select();
        }
      }

      if (
        target instanceof app.ownerWindow.HTMLElement &&
        (target === searchInputRef.current ||
          target.closest(".layer-ui__result-item"))
      ) {
        if (stableState.searchMatches.items.length) {
          if (event.key === KEYS.ENTER) {
            event.stopPropagation();
            stableState.goToNextItem();
          }

          if (event.key === KEYS.ARROW_UP) {
            event.stopPropagation();
            stableState.goToPreviousItem();
          } else if (event.key === KEYS.ARROW_DOWN) {
            event.stopPropagation();
            stableState.goToNextItem();
          }
        }
      }
    };

    // `capture` needed to prevent firing on initial open from App.tsx,
    // as well as to handle events before App ones
    return addEventListener(app.ownerWindow, EVENT.KEYDOWN, eventHandler, {
      capture: true,
      passive: false,
    });
  }, [setAppState, stableState, app]);

  const matchCount = `${searchMatches.items.length} ${
    searchMatches.items.length === 1
      ? t("search.singleResult")
      : t("search.multipleResults")
  }`;

  return (
    <div className="layer-ui__search" aria-busy={isSearching}>
      <div className="layer-ui__search-header">
        <TextField
          className={CLASSES.SEARCH_MENU_INPUT_WRAPPER}
          value={inputValue}
          ref={searchInputRef}
          placeholder={t("search.placeholder")}
          icon={searchIcon}
          onChange={setInputValue}
          selectOnRender
        />
      </div>

      <div className="layer-ui__search-options">
        <label>
          {t("search.scope")}
          <select
            aria-label={t("search.scope")}
            value={scope.type}
            onChange={(event) => {
              const type = event.target.value;
              setScope(
                type === "frame"
                  ? { type, frameId: null }
                  : { type: type === "selection" ? "selection" : "all" },
              );
            }}
          >
            <option value="all">{t("search.wholeDrawing")}</option>
            <option value="selection">{t("search.currentSelection")}</option>
            <option value="frame">{t("search.chosenFrame")}</option>
          </select>
        </label>
        {scope.type === "frame" && (
          <label>
            {t("search.chosenFrame")}
            <select
              aria-label={t("search.chosenFrame")}
              value={scope.frameId ?? ""}
              onChange={(event) =>
                setScope({ type: "frame", frameId: event.target.value || null })
              }
            >
              <option value="">{t("search.chooseFrame")}</option>
              {scope.frameId &&
                !frames.some((frame) => frame.id === scope.frameId) && (
                  <option value={scope.frameId}>
                    {t("search.frameUnavailable")}
                  </option>
                )}
              {frames.map((frame) => (
                <option key={frame.id} value={frame.id}>
                  {frame.name ?? getDefaultFrameName(frame)}
                </option>
              ))}
            </select>
          </label>
        )}
        {scope.type === "selection" && (
          <div className="layer-ui__search-hint">
            {t("search.liveSelectionHint")}
          </div>
        )}
        <label className="layer-ui__search-match-case">
          <input
            type="checkbox"
            checked={matchCase}
            onChange={(event) => setMatchCase(event.target.checked)}
          />
          {t("search.matchCase")}
        </label>
      </div>

      <div className="layer-ui__search-count">
        {searchMatches.items.length > 0 && (
          <>
            {focusIndex !== null && focusIndex > -1 ? (
              <div>
                {focusIndex + 1} / {matchCount}
              </div>
            ) : (
              <div>{matchCount}</div>
            )}
            <div className="result-nav">
              <Button
                onSelect={() => {
                  goToNextItem();
                }}
                aria-label={t("search.nextMatch")}
                className="result-nav-btn"
              >
                {collapseDownIcon}
              </Button>
              <Button
                onSelect={() => {
                  goToPreviousItem();
                }}
                aria-label={t("search.previousMatch")}
                className="result-nav-btn"
              >
                {upIcon}
              </Button>
            </div>
          </>
        )}

        {searchMatches.items.length === 0 && searchQuery && !isSearching && (
          <div style={{ margin: "1rem auto" }}>{t("search.noMatch")}</div>
        )}
      </div>

      <MatchList
        matches={searchMatches}
        onItemClick={setFocusIndex}
        focusIndex={focusIndex}
      />
    </div>
  );
};

const ListItem = (props: {
  preview: SearchMatchItem["preview"];
  searchQuery: SearchQuery;
  highlighted: boolean;
  onClick?: () => void;
}) => {
  const preview = [
    props.preview.moreBefore ? "..." : "",
    props.preview.previewText.slice(0, props.preview.indexInSearchQuery),
    props.preview.previewText.slice(
      props.preview.indexInSearchQuery,
      props.preview.indexInSearchQuery + props.searchQuery.length,
    ),
    props.preview.previewText.slice(
      props.preview.indexInSearchQuery + props.searchQuery.length,
    ),
    props.preview.moreAfter ? "..." : "",
  ];

  return (
    <div
      tabIndex={-1}
      className={clsx("layer-ui__result-item", {
        active: props.highlighted,
      })}
      onClick={props.onClick}
      ref={(ref) => {
        if (props.highlighted) {
          ref?.scrollIntoView({ behavior: "auto", block: "nearest" });
        }
      }}
    >
      <div className="preview-text">
        {preview.flatMap((text, idx) => (
          <Fragment key={idx}>{idx === 2 ? <b>{text}</b> : text}</Fragment>
        ))}
      </div>
    </div>
  );
};

interface MatchListProps {
  matches: SearchMatches;
  onItemClick: (index: number) => void;
  focusIndex: number | null;
}

const MatchListBase = (props: MatchListProps) => {
  const frameNameMatches = useMemo(
    () =>
      props.matches.items.filter((match) => isFrameLikeElement(match.element)),
    [props.matches],
  );

  const textMatches = useMemo(
    () => props.matches.items.filter((match) => isTextElement(match.element)),
    [props.matches],
  );

  return (
    <div>
      {frameNameMatches.length > 0 && (
        <div className="layer-ui__search-result-container">
          <div className="layer-ui__search-result-title">
            <div className="title-icon">{frameToolIcon}</div>
            <div>{t("search.frames")}</div>
          </div>
          {frameNameMatches.map((searchMatch, index) => (
            <ListItem
              key={searchMatch.element.id + searchMatch.index}
              searchQuery={searchMatch.searchQuery}
              preview={searchMatch.preview}
              highlighted={index === props.focusIndex}
              onClick={() => props.onItemClick(index)}
            />
          ))}

          {textMatches.length > 0 && <div className="layer-ui__divider" />}
        </div>
      )}

      {textMatches.length > 0 && (
        <div className="layer-ui__search-result-container">
          <div className="layer-ui__search-result-title">
            <div className="title-icon">{TextIcon}</div>
            <div>{t("search.texts")}</div>
          </div>
          {textMatches.map((searchMatch, index) => (
            <ListItem
              key={searchMatch.element.id + searchMatch.index}
              searchQuery={searchMatch.searchQuery}
              preview={searchMatch.preview}
              highlighted={index + frameNameMatches.length === props.focusIndex}
              onClick={() => props.onItemClick(index + frameNameMatches.length)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const areEqual = (prevProps: MatchListProps, nextProps: MatchListProps) => {
  return (
    prevProps.matches.nonce === nextProps.matches.nonce &&
    prevProps.focusIndex === nextProps.focusIndex
  );
};

const MatchList = memo(MatchListBase, areEqual);
