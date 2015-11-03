# Release strategy

A release branch is created for each release, so point fixes can
be made as-needed regardless of the state of master.

On the master branch, the package version is always an 'alpha' prerelease
with number matching the next release.

        v1.0.0   v1.0.1               v1.1.0
        |        |                    |
      ______________ 1.0.0    ___________ 1.1.0
     /                       /
   ------------------------------- master
   |  |                       |
   |  |                       +-- package version v1.2.0-alpha.0
   |  +--- package version v1.1.0-alpha.0
   +-- package version v1.0.0-alpha.0


In this example there are two release branches, 1.0.0, 1.1.0, and
master. There have been two releases on 1.0.0 (v1.0.0 and v1.0.1),
and one release on 1.1.0 (v1.1.0).

When picking the next prelease version, we don't know if the next
release will be major or minor, so we always pick minor. After a
commit with breaking change, the major version must be incremented.

The ```release``` script automates these steps, incrementing the version,
creating the branches, tagging the releases, pushing to origin, and
publishing with npm. The workflow is as follows.

 - Commits are made into master (directly, or merged from task or dev branches).
 - When release for release, run "release new". This will branch, tag, push, and publish.
 - Continue work on master.
 - If a patch is required on the release branch, commit the patch(es), then run "release patch <release-branch>" to tag and publish the patch release.
 - If a commit on master makes a breaking change, run "release major" to increment the major version and push to origin.

# Caveats

This tool does not allow for throttling commits, e.g. pulling a release branch
and making bug fix commits (during QA, for example) prior to publishing. We can
revisit this if it becomes necessary.
