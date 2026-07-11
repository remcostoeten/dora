import Link from 'next/link'

import { ResourcesPageShell } from '@/components/resources-page-shell'

const COMMANDS = [
    {
        name: 'Interactive runner',
        command: 'cd tools/dora-cli && go run .',
        detail:
            'Launches the Bubble Tea TUI for build, VM, release, and maintenance flows.'
    },
    {
        name: 'VM bootstrap',
        command: 'dora-manager-executor vm init --config .dora-vm.yaml',
        detail:
            'Creates the VM config, prepares storage, and can download the base image when configured.'
    },
    {
        name: 'VM execution',
        command: 'dora-manager-executor vm ensure && dora-manager-executor vm run --command "..."',
        detail:
            'Ensures the guest is defined and running, then runs a command through the guest agent.'
    },
    {
        name: 'macOS CI dispatch',
        command: 'dora-manager-executor ci mac --ref main --workflow ci-mac.yml',
        detail:
            'Dispatches the GitHub Actions workflow used for the macOS CI path.'
    }
] as const

const WORKFLOW_NOTES = [
    'Built in Go 1.24 with Bubble Tea and Lip Gloss for the TUI.',
    'Supports Linux-hosted VM automation through KVM/libvirt and qemu-guest-agent.',
    'Finds the repository root automatically so the runner works from nested folders.',
    'Falls back to the interactive TUI when no subcommand is provided.'
] as const

export default function GoCliRunnerView() {
    return (
        <ResourcesPageShell
            eyebrow="Developer docs"
            title="Dora manager executor"
            lead="Dora ships a small Go-based manager executor for interactive maintenance, VM automation, and CI dispatch. It runs as a TUI first, with subcommands for repeatable workflows."
        >
            <div className="mx-auto grid max-w-4xl gap-10">
                <article className="grid gap-6">
                    <div className="grid gap-4 text-[15px] leading-relaxed text-muted-foreground">
                        <p>
                            The executor lives in <code>tools/dora-cli</code> and is
                            designed for the work that usually gets split across a
                            terminal, a VM shell, and GitHub Actions. If you run it
                            with no arguments, you get the interactive TUI. If you
                            pass a subcommand, it switches to the CLI path.
                        </p>
                        <p>
                            The main goal is to keep release, test, and maintenance
                            flows close to the repository. That makes it easier to
                            automate repeatable developer tasks without introducing a
                            separate toolchain or a second control surface.
                        </p>
                    </div>

                    <section aria-labelledby="runner-commands-heading">
                        <h2
                            id="runner-commands-heading"
                            className="mb-4 font-pixel text-xl font-medium text-foreground"
                        >
                            Common commands
                        </h2>
                        <div className="grid gap-3">
                            {COMMANDS.map(function (item) {
                                return (
                                    <div
                                        key={item.name}
                                        className="border border-line bg-background/30 px-4 py-4"
                                    >
                                        <div className="flex flex-wrap items-baseline justify-between gap-3">
                                            <h3 className="text-sm font-medium text-foreground">
                                                {item.name}
                                            </h3>
                                            <code className="font-mono text-[11px] text-brand-200">
                                                {item.command}
                                            </code>
                                        </div>
                                        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                                            {item.detail}
                                        </p>
                                    </div>
                                )
                            })}
                        </div>
                    </section>

                    <section aria-labelledby="workflow-heading">
                        <h2
                            id="workflow-heading"
                            className="mb-4 font-pixel text-xl font-medium text-foreground"
                        >
                            What the executor is used for
                        </h2>
                        <ul className="grid gap-3">
                            {WORKFLOW_NOTES.map(function (note) {
                                return (
                                    <li
                                        key={note}
                                        className="relative pl-4 text-sm leading-relaxed text-muted-foreground before:absolute before:left-0 before:top-[0.65em] before:h-1 before:w-1 before:-translate-y-1/2 before:rounded-full before:bg-brand-200/60"
                                    >
                                        {note}
                                    </li>
                                )
                            })}
                        </ul>
                    </section>

                    <section aria-labelledby="vm-heading">
                        <h2
                            id="vm-heading"
                            className="mb-4 font-pixel text-xl font-medium text-foreground"
                        >
                            VM workflow
                        </h2>
                        <div className="grid gap-4 text-[15px] leading-relaxed text-muted-foreground">
                            <p>
                                The VM flow is driven by{' '}
                                <code>dora-manager-executor vm init</code>,{' '}
                                <code>dora-manager-executor vm ensure</code>,{' '}
                                <code>dora-manager-executor vm run</code>, and the
                                cleanup commands that stop or remove the managed
                                guest. The config lives in{' '}
                                <code>.dora-vm.yaml</code> at the repository root.
                            </p>
                            <p>
                                That keeps the guest shell, image path, storage
                                directory, and guest-agent command in one place so the
                                same executor can bootstrap, run, inspect logs, and clean
                                up the VM without manual setup in every session.
                            </p>
                        </div>
                    </section>

                    <section aria-labelledby="ci-heading">
                        <h2
                            id="ci-heading"
                            className="mb-4 font-pixel text-xl font-medium text-foreground"
                        >
                            CI dispatch
                        </h2>
                        <div className="grid gap-4 text-[15px] leading-relaxed text-muted-foreground">
                            <p>
                                <code>dora-manager-executor ci mac</code> wraps GitHub
                                CLI workflow
                                dispatch for the macOS pipeline. It accepts a ref,
                                workflow name, and optional repo override, then streams
                                the <code>gh workflow run</code> command for you.
                            </p>
                            <p>
                                This is useful when you want the runner to stay close
                                to the repository rather than copy workflow names into a
                                separate script or remember the exact GitHub CLI flags
                                every time.
                            </p>
                        </div>
                    </section>

                    <section aria-labelledby="install-heading">
                        <h2
                            id="install-heading"
                            className="mb-4 font-pixel text-xl font-medium text-foreground"
                        >
                            Setup notes
                        </h2>
                        <div className="grid gap-4 text-[15px] leading-relaxed text-muted-foreground">
                            <p>
                            The module targets Go 1.24 and uses Bubble Tea for the
                                terminal UI. The VM commands are Linux-only on the host
                                because they rely on KVM/libvirt and qemu-guest-agent.
                            </p>
                            <p>
                                If you want the same commands in your shell, run the
                                module from <code>tools/dora-cli</code> with{' '}
                                <code>go run .</code> or build it with{' '}
                                <code>go build -o ../../dora-manager-executor .</code>.
                            </p>
                        </div>
                    </section>
                </article>

                <div className="flex flex-wrap gap-3">
                    <Link
                        className="inline-flex min-h-10 items-center border border-brand-200/50 px-4 text-[13px] text-brand-200 transition-colors hover:bg-brand-200/6"
                        href="/docs"
                    >
                        Back to docs
                    </Link>
                    <Link
                        className="inline-flex min-h-10 items-center border border-line px-4 text-[13px] text-muted-foreground transition-colors hover:border-line-strong hover:text-foreground"
                        href="/features/drizzle-runner"
                    >
                        Browse features
                    </Link>
                </div>
            </div>
        </ResourcesPageShell>
    )
}
