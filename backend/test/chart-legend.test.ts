import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";
import { select } from "d3-selection";
import drawLegend from "../../shared/packages/utils/drawLegend";
import { measureXkcdText } from "../../shared/packages/utils/measureXkcdText";
import type { D3Selection, LegendPosition } from "../../shared/packages/types";
import XYChartGithub from "../../shared/packages/xy-chart-github";
import { measureMonaText } from "../../shared/packages/utils/measureMonaText";

function renderLegend(labels: string[], position: LegendPosition = "top-left") {
  const dom = new JSDOM('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
  const svg = dom.window.document.querySelector("svg")!;
  drawLegend(select(svg) as unknown as D3Selection, {
    items: labels.map(text => ({ text, color: "red", logo: "" })),
    strokeColor: "black",
    backgroundColor: "white",
    legendPosition: position,
    chartWidth: 600,
    chartHeight: 400,
  });
  return svg;
}

for (const position of ["top-left", "bottom-right"] as const) {
  test(`GitHub legend uses consistent padding at ${position}`, () => {
    const widths: number[] = [];
    for (const label of ["a/b", "iii/lll", "WWW/mmm", "meilisearch/meilisearch",
      "long-organization-name/very-long-repository-name"]) {
      const svg = new JSDOM('<svg xmlns="http://www.w3.org/2000/svg" width="680"></svg>')
        .window.document.querySelector("svg")!;
      XYChartGithub(svg as unknown as SVGSVGElement, {
        title: "", xLabel: "", yLabel: "", showDots: false, transparent: false,
        data: { datasets: [{ label, logo: "", data: [{ x: 1, y: 1 }, { x: 2, y: 2 }] }] },
      }, { xTickLabelType: "Number", legendPosition: position });
      const text = Array.from(svg.querySelectorAll("text")).find(t => t.textContent === label)!;
      const background = text.parentElement!.querySelector("rect")!;
      const width = Number(background.getAttribute("width"));
      const textWidth = Number(text.getAttribute("textLength"));
      assert.equal(textWidth, measureMonaText(label, 14));
      assert.equal(text.getAttribute("lengthAdjust"), "spacingAndGlyphs");
      const padding = Number(background.getAttribute("x")) + width -
        Number(text.getAttribute("x")) - textWidth;
      assert.ok(padding >= 8 && padding < 9);
      widths.push(width);
    }
    assert.ok(widths[1] < widths[2], "equal-length narrow and wide names need different widths");
  });
}

test("legend widths follow glyph widths, not character counts", () => {
  const narrow = renderLegend(["iii/lll"]).querySelector("rect")!;
  const wide = renderLegend(["WWW/mmm"]).querySelector("rect")!;
  assert.ok(Number(wide.getAttribute("width")) > Number(narrow.getAttribute("width")));
  assert.equal(measureXkcdText("i", 15), 227 * 15 / 856);
});

for (const position of ["top-left", "bottom-right"] as const) {
  for (const labels of [["meilisearch/meilisearch"], ["iii/lll", "WWW/mmm"]]) {
    test(`legend fits the widest label and logos at ${position}: ${labels}`, () => {
      const svg = renderLegend(labels, position);
      const background = svg.querySelector("rect")!;
      const width = Number(background.getAttribute("width"));
      const x = Number(background.getAttribute("x"));
      const texts = Array.from(svg.querySelectorAll("text"));
      for (const text of texts) {
        assert.equal(Number(text.getAttribute("textLength")), measureXkcdText(text.textContent!, 15));
        assert.equal(text.getAttribute("lengthAdjust"), "spacingAndGlyphs");
      }
      const textRight = Math.max(...texts.map(text =>
        Number(text.getAttribute("x")) + measureXkcdText(text.textContent!, 15)));
      const rightPadding = x + width - textRight;
      assert.ok(rightPadding >= 7 && rightPadding < 8);
      if (position === "bottom-right") assert.equal(x + width, 592);
      assert.equal(svg.querySelectorAll("image").length, labels.length > 1 ? 2 : 0);
    });
  }
}
