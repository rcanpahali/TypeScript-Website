type StoryContent =
  | { type: "html"; html: string; title: string }
  | { type: "code"; code: string; params: string; title: string }
  | { type: "hr" }

import type { Sandbox } from "typescriptlang-org/static/js/sandbox"
import type { UI } from "./createUI"

export const gistPoweredNavBar = (sandbox: Sandbox, ui: UI, showNav: () => void) => {
  const setCode = (code: string) => {
    const story = document.getElementById("story-container")
    if (story) story.style.display = "none"

    const toolbar = document.getElementById("editor-toolbar")
    if (toolbar) toolbar.style.display = "block"

    const monaco = document.getElementById("monaco-editor-embed")
    if (monaco) monaco.style.display = "block"

    sandbox.setText(code)
    sandbox.editor.layout()
  }

  const setStory = (html: string) => {
    const toolbar = document.getElementById("editor-toolbar")
    if (toolbar) toolbar.style.display = "none"

    const monaco = document.getElementById("monaco-editor-embed")
    if (monaco) monaco.style.display = "none"

    const story = document.getElementById("story-container")
    if (!story) return

    story.style.display = "block"
    story.innerHTML = html

    for (const a of Array.from(story.getElementsByTagName("a"))) {
      const path = a.pathname
      if (!path.startsWith("/play")) return

      // overwrite playground links
      if (a.hash.includes("#code")) {
        a.onclick = e => {
          const code = a.hash.replace("#code/", "").trim()
          let userCode = sandbox.lzstring.decompressFromEncodedURIComponent(code)
          // Fallback incase there is an extra level of decoding:
          // https://gitter.im/Microsoft/TypeScript?at=5dc478ab9c39821509ff189a
          if (!userCode) userCode = sandbox.lzstring.decompressFromEncodedURIComponent(decodeURIComponent(code))
          if (userCode) setCode(userCode)

          e.preventDefault()
          return false
        }
      }

      // overwrite gist links
      else if (a.hash.includes("#gist/")) {
        a.onclick = e => {
          const index = Number(a.hash.split("-")[1])
          const nav = document.getElementById("navigation-container")
          if (!nav) return
          const ul = nav.getElementsByTagName("ul").item(0)!

          const targetedLi = ul.children.item(Number(index) || 0) || ul.children.item(0)
          if (targetedLi) {
            const a = targetedLi.getElementsByTagName("a").item(0)
            // @ts-ignore
            if (a) a.click()
          }
          e.preventDefault()
          return false
        }
      } else {
        a.target = "_blank"
      }
    }
  }

  const gistHash = location.hash.split("#gist/")[1]
  const [gistID, gistStoryIndex] = gistHash.split("-")
  fetch(`http://localhost:7071/api/API?gistID=${gistID}`).then(async res => {
    const response = await res.json()
    if ("error" in response) {
      return ui.flashInfo(response.display)
    }

    if (response.type === "code") {
      sandbox.setText(response.code)
      sandbox.setCompilerSettings(response.params)
      sandbox.editor.updateOptions({ readOnly: false })
    } else if (response.type === "story") {
      showNav()

      const nav = document.getElementById("navigation-container")
      if (!nav) return

      const title = document.createElement("h4")
      title.textContent = response.title
      nav.appendChild(title)

      const ul = document.createElement("ul")
      response.files.forEach((element: StoryContent, i: number) => {
        const li = document.createElement("li")
        switch (element.type) {
          case "html":
          case "code": {
            li.classList.add("selectable")
            const a = document.createElement("a")
            a.textContent = element.title
            a.href = `/play?#gist/${gistID}-${i}`

            a.onclick = e => {
              e.preventDefault()

              const ed = sandbox.editor.getDomNode()
              if (!ed) return
              sandbox.editor.updateOptions({ readOnly: false })
              const alreadySelected = ul.querySelector(".selected") as HTMLElement
              if (alreadySelected) alreadySelected.classList.remove("selected")

              li.classList.add("selected")
              if (element.type === "code") {
                setCode(element.code)
              } else if (element.type === "html") {
                setStory(element.html)
              }

              const alwaysUpdateURL = !localStorage.getItem("disable-save-on-type")
              if (alwaysUpdateURL) {
                location.hash = `#gist/${gistID}-${i}`
              }
              return false
            }
            li.appendChild(a)

            break
          }
          case "hr": {
            const hr = document.createElement("hr")
            li.appendChild(hr)
          }
        }
        ul.appendChild(li)
      })
      nav.appendChild(ul)

      const targetedLi = ul.children.item(Number(gistStoryIndex) || 0) || ul.children.item(0)
      if (targetedLi) {
        const a = targetedLi.getElementsByTagName("a").item(0)
        // @ts-ignore
        if (a) a.click()
      }
    }
  })
}
