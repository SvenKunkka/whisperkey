import CoreGraphics
import Foundation

let pollIntervalUs: useconds_t = 50_000
let args = CommandLine.arguments.dropFirst().map { $0.uppercased() }

func has(_ token: String, in flags: CGEventFlags) -> Bool {
    switch token {
    case "META", "LEFT META", "RIGHT META":
        return flags.contains(.maskCommand)
    case "SHIFT", "LEFT SHIFT", "RIGHT SHIFT":
        return flags.contains(.maskShift)
    case "CTRL", "LEFT CTRL", "RIGHT CTRL":
        return flags.contains(.maskControl)
    case "ALT", "LEFT ALT", "RIGHT ALT", "LEFT OPTION", "RIGHT OPTION":
        return flags.contains(.maskAlternate)
    default:
        return false
    }
}

func emit(_ line: String) {
    FileHandle.standardOutput.write(Data((line + "\n").utf8))
}

var last = false

while true {
    let flags = CGEventSource.flagsState(.hidSystemState)
    let current = !args.isEmpty && args.allSatisfy { has($0, in: flags) }

    if current != last {
        emit(current ? "DOWN" : "UP")
        last = current
    }

    usleep(pollIntervalUs)
}
