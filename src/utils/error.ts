/**
 * Thrown when the error is not related to Codex/network
 */
export class TimeoutError extends Error {}

export class ContainerImageConflictError extends Error {
  existingContainersImage: string
  newContainersImage: string

  constructor(message: string, existingContainersImage: string, newContainersImage: string) {
    super(message)
    this.existingContainersImage = existingContainersImage
    this.newContainersImage = newContainersImage
  }
}
